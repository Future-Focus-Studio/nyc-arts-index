import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import type { Candidate, CandidateWithHandle } from "./types.js";

const INPUT_FILE = "data/phase1-candidates.json";
const OUTPUT_FILE = "data/phase2-with-handles.json";

const FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v1/scrape";
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 100;
const REQUEST_TIMEOUT_MS = 15000;

const INSTAGRAM_RE = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)\/?/g;
const RESERVED_PATHS = new Set([
  "p", "explore", "reel", "reels", "stories", "tv", "accounts", "about",
  "developer", "directory", "legal", "popular", "web", "direct",
]);

function extractHandle(text: string): string | undefined {
  INSTAGRAM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INSTAGRAM_RE.exec(text)) !== null) {
    const candidate = m[1];
    if (!candidate) continue;
    if (RESERVED_PATHS.has(candidate.toLowerCase())) continue;
    return candidate.replace(/^@/, "");
  }
  return undefined;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

interface FirecrawlScrapeResponse {
  success?: boolean;
  data?: {
    markdown?: string;
    metadata?: Record<string, unknown>;
  };
  error?: string;
}

async function scrapeOne(apiKey: string, url: string): Promise<string | undefined> {
  try {
    const resp = await axios.post<FirecrawlScrapeResponse>(
      FIRECRAWL_ENDPOINT,
      { url, formats: ["markdown"], onlyMainContent: false },
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    const markdown = resp.data?.data?.markdown ?? "";
    if (!markdown) return undefined;
    return extractHandle(markdown);
  } catch {
    return undefined;
  }
}

async function crawlBatch(apiKey: string, urls: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (urls.length === 0) return result;

  const totalBatches = Math.ceil(urls.length / BATCH_SIZE);
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const settled = await Promise.allSettled(batch.map((u) => scrapeOne(apiKey, u)));
    let scraped = 0;
    let found = 0;
    settled.forEach((res, idx) => {
      const url = batch[idx]!;
      if (res.status === "fulfilled") {
        scraped++;
        if (res.value) {
          result.set(url, res.value);
          found++;
        }
      }
    });
    console.log(`[phase2] Batch ${batchNum}/${totalBatches}: scraped ${scraped}, found handle for ${found}`);
    if (i + BATCH_SIZE < urls.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }
  return result;
}

// Free, no-API-key web search fallback for Instagram handles. DuckDuckGo's
// HTML and API endpoints are unreachable from this network's egress, so we
// use Brave Search's HTML interface, which returns organic results with raw
// instagram.com URLs we can regex.
async function searchInstagramHandle(orgName: string): Promise<string | undefined> {
  const query = `"${orgName}" site:instagram.com`;
  const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
  try {
    const resp = await axios.get<string>(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      responseType: "text",
    });
    const handle = extractHandle(resp.data);
    if (handle) return handle;
  } catch (err) {
    console.warn(`[phase2] Search failed for "${orgName}": ${(err as Error).message}`);
  }
  return undefined;
}

async function main(): Promise<void> {
  if (await fileExists(OUTPUT_FILE)) {
    console.log(`[phase2] ${OUTPUT_FILE} already exists — skipping (already done).`);
    return;
  }
  if (!(await fileExists(INPUT_FILE))) {
    console.error(`[phase2] Missing input ${INPUT_FILE}. Run phase1 first.`);
    process.exit(1);
  }
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error("[phase2] FIRECRAWL_API_KEY missing in environment.");
    process.exit(1);
  }

  const candidates: Candidate[] = JSON.parse(await fs.readFile(INPUT_FILE, "utf-8"));
  console.log(`[phase2] Loaded ${candidates.length} candidates from ${INPUT_FILE}`);

  // Split: candidates with instagram_handle_hint short-circuit the crawler entirely.
  const withHint = candidates.filter((c) => Boolean(c.instagram_handle_hint));
  const withoutHint = candidates.filter((c) => !c.instagram_handle_hint);
  const needsCrawl = withoutHint.filter((c): c is Candidate & { website: string } => Boolean(c.website));
  const noWebsiteNoHint = withoutHint.filter((c) => !c.website);

  console.log(`[phase2] ${withHint.length} have handle hints (skip crawl)`);
  console.log(`[phase2] ${needsCrawl.length} need crawling`);
  console.log(`[phase2] ${noWebsiteNoHint.length} have no website and no hint (handle left blank)`);

  const urls = needsCrawl.map((c) => c.website);
  let handleMap = new Map<string, string>();
  if (urls.length > 0) {
    console.log(`[phase2] Scraping ${urls.length} websites with Firecrawl…`);
    handleMap = await crawlBatch(apiKey, urls);
    console.log(`[phase2] Resolved ${handleMap.size}/${urls.length} handles via Firecrawl`);
  }

  // Step 1: apply hint or crawl result.
  const intermediate: CandidateWithHandle[] = candidates.map((c) => {
    if (c.instagram_handle_hint) {
      return {
        ...c,
        instagram_handle: c.instagram_handle_hint,
        instagram_url: `https://www.instagram.com/${c.instagram_handle_hint}/`,
      };
    }
    const handle = c.website ? handleMap.get(c.website) : undefined;
    if (handle) {
      return {
        ...c,
        instagram_handle: handle,
        instagram_url: `https://www.instagram.com/${handle}/`,
      };
    }
    return { ...c };
  });

  // Step 2: search fallback for orgs still unresolved.
  const unresolved = intermediate.filter((c) => !c.instagram_handle);
  console.log(`[phase2] ${unresolved.length} orgs unresolved after Firecrawl — running search fallback (Brave)…`);
  let searchResolved = 0;
  for (const c of unresolved) {
    const handle = await searchInstagramHandle(c.name);
    if (handle) {
      c.instagram_handle = handle;
      c.instagram_url = `https://www.instagram.com/${handle}/`;
      searchResolved++;
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  console.log(`[phase2] Search fallback resolved ${searchResolved}/${unresolved.length} additional handles`);

  const totalResolved = intermediate.filter((c) => c.instagram_handle).length;
  console.log(`[phase2] Total resolved: ${totalResolved}/${candidates.length}`);

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(intermediate, null, 2));
  console.log(`[phase2] Wrote ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(`[phase2] Fatal: ${(err as Error).message}`);
  process.exit(1);
});
