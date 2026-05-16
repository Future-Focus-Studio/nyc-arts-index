import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { ApifyClient } from "apify-client";
import type { Candidate, CandidateWithHandle } from "./types.js";

const INPUT_FILE = "data/phase1-candidates.json";
const OUTPUT_FILE = "data/phase2-with-handles.json";

const INSTAGRAM_RE = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)\/?/g;
const RESERVED_PATHS = new Set(["p", "explore", "reels", "stories", "tv", "accounts", "about", "developer", "directory", "legal"]);

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

interface CrawlerItem {
  url?: string;
  loadedUrl?: string;
  text?: string;
  html?: string;
}

async function crawlBatch(client: ApifyClient, urls: string[]): Promise<Map<string, string>> {
  // Returns a map from input URL → extracted Instagram handle (if found).
  const result = new Map<string, string>();
  if (urls.length === 0) return result;

  const startUrls = urls.map((u) => ({ url: u }));
  const run = await client.actor("apify/website-content-crawler").call({
    startUrls,
    maxCrawlDepth: 1,
    maxCrawlPages: urls.length * 2,
    crawlerType: "cheerio",
    saveHtml: false,
    saveMarkdown: false,
    initialConcurrency: 5,
    maxConcurrency: 10,
    requestTimeoutSecs: 30,
  });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const crawlItems = items as unknown as CrawlerItem[];

  for (const item of crawlItems) {
    const sourceUrl = item.loadedUrl ?? item.url;
    if (!sourceUrl) continue;
    const haystack = `${item.text ?? ""}\n${item.html ?? ""}`;
    const handle = extractHandle(haystack);
    if (handle) {
      // Map back to the candidate's original website (the host part should match).
      const host = new URL(sourceUrl).host.replace(/^www\./, "");
      for (const url of urls) {
        try {
          if (new URL(url).host.replace(/^www\./, "") === host) {
            if (!result.has(url)) result.set(url, handle);
          }
        } catch {
          // skip invalid URLs
        }
      }
    }
  }
  return result;
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
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error("[phase2] APIFY_TOKEN missing in environment.");
    process.exit(1);
  }

  const candidates: Candidate[] = JSON.parse(await fs.readFile(INPUT_FILE, "utf-8"));
  console.log(`[phase2] Loaded ${candidates.length} candidates from ${INPUT_FILE}`);

  const withWebsite = candidates.filter((c): c is Candidate & { website: string } => Boolean(c.website));
  const withoutWebsite = candidates.filter((c) => !c.website);

  const urls = withWebsite.map((c) => c.website);
  console.log(`[phase2] Crawling ${urls.length} websites for Instagram handles…`);

  const client = new ApifyClient({ token });
  let handleMap = new Map<string, string>();
  try {
    handleMap = await crawlBatch(client, urls);
  } catch (err) {
    console.error(`[phase2] Crawler run failed: ${(err as Error).message}`);
    process.exit(1);
  }
  console.log(`[phase2] Resolved ${handleMap.size}/${urls.length} handles via crawler`);

  const enriched: CandidateWithHandle[] = candidates.map((c) => {
    const handle = c.instagram_handle_hint ?? (c.website ? handleMap.get(c.website) : undefined);
    if (!handle) return c;
    return {
      ...c,
      instagram_handle: handle,
      instagram_url: `https://www.instagram.com/${handle}/`,
    };
  });

  console.log(`[phase2] ${withoutWebsite.length} candidates had no website (handle left blank)`);

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(enriched, null, 2));
  console.log(`[phase2] Wrote ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(`[phase2] Fatal: ${(err as Error).message}`);
  process.exit(1);
});
