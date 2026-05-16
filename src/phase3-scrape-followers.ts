import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { ApifyClient } from "apify-client";
import type { Candidate, CandidateWithHandle, OrgWithFollowers } from "./types.js";

const INPUT_FILE = "data/phase2-with-handles.json";
const OUTPUT_FILE = "data/phase3-with-followers.json";

const PRIMARY_ACTOR = "scrapebase/instagram-followers-count-scraper";
const FALLBACK_ACTOR = "apify/instagram-scraper";

interface FollowerRow {
  username?: string;
  handle?: string;
  followersCount?: number;
  followers?: number;
  followerCount?: number;
  url?: string;
}

function normalizeHandle(h: string): string {
  return h.toLowerCase().replace(/^@/, "").trim();
}

function sourcePriority(source: Candidate["source"]): number {
  if (source === "seed") return 0;
  if (source === "artsy") return 1;
  return 2;
}

function completenessScore(c: CandidateWithHandle): number {
  let n = 0;
  if (c.website) n++;
  if (c.neighborhood) n++;
  if (c.borough && c.borough !== "Unknown") n++;
  if (c.instagram_handle_hint) n++;
  if (c.notes) n++;
  return n;
}

function dedupByHandle(candidates: CandidateWithHandle[]): { kept: CandidateWithHandle[]; removed: number } {
  const byHandle = new Map<string, CandidateWithHandle>();
  const noHandle: CandidateWithHandle[] = [];
  let removed = 0;
  for (const c of candidates) {
    if (!c.instagram_handle) {
      noHandle.push(c);
      continue;
    }
    const key = normalizeHandle(c.instagram_handle);
    const existing = byHandle.get(key);
    if (!existing) {
      byHandle.set(key, c);
      continue;
    }
    const sa = sourcePriority(existing.source);
    const sb = sourcePriority(c.source);
    let winner = existing;
    if (sb < sa) {
      winner = c;
    } else if (sb === sa) {
      const ca = completenessScore(existing);
      const cb = completenessScore(c);
      if (cb > ca) winner = c;
    }
    byHandle.set(key, winner);
    removed++;
  }
  return { kept: [...byHandle.values(), ...noHandle], removed };
}

function extractHandleFromUrl(u: string | undefined): string | undefined {
  if (!u) return undefined;
  try {
    const parts = new URL(u).pathname.split("/").filter(Boolean);
    return parts[0]?.toLowerCase();
  } catch {
    return undefined;
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function runPrimary(client: ApifyClient, handles: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const usernames = handles.map(normalizeHandle);
  const run = await client.actor(PRIMARY_ACTOR).call({
    usernames,
  });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const rows = items as unknown as FollowerRow[];
  for (const row of rows) {
    const handle =
      (row.username && normalizeHandle(row.username)) ||
      (row.handle && normalizeHandle(row.handle)) ||
      extractHandleFromUrl(row.url);
    const count = row.followersCount ?? row.followers ?? row.followerCount;
    if (handle && typeof count === "number") {
      map.set(handle, count);
    }
  }
  return map;
}

async function runFallback(client: ApifyClient, handles: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const usernames = handles.map(normalizeHandle);
  const directUrls = usernames.map((u) => `https://www.instagram.com/${u}/`);
  const run = await client.actor(FALLBACK_ACTOR).call({
    directUrls,
    resultsType: "details",
    resultsLimit: 1,
  });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const rows = items as unknown as FollowerRow[];
  for (const row of rows) {
    const handle =
      (row.username && normalizeHandle(row.username)) ||
      extractHandleFromUrl(row.url);
    const count = row.followersCount ?? row.followers ?? row.followerCount;
    if (handle && typeof count === "number") {
      map.set(handle, count);
    }
  }
  return map;
}

async function main(): Promise<void> {
  if (await fileExists(OUTPUT_FILE)) {
    console.log(`[phase3] ${OUTPUT_FILE} already exists — skipping (already done).`);
    return;
  }
  if (!(await fileExists(INPUT_FILE))) {
    console.error(`[phase3] Missing input ${INPUT_FILE}. Run phase2 first.`);
    process.exit(1);
  }
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error("[phase3] APIFY_TOKEN missing in environment.");
    process.exit(1);
  }

  const rawCandidates: CandidateWithHandle[] = JSON.parse(await fs.readFile(INPUT_FILE, "utf-8"));
  console.log(`[phase3] Loaded ${rawCandidates.length} candidates from ${INPUT_FILE}`);

  const handleDedup = dedupByHandle(rawCandidates);
  console.log(`[phase3] Instagram handle dedup: removed ${handleDedup.removed}, kept ${handleDedup.kept.length}`);
  const candidates = handleDedup.kept;

  const withHandles = candidates.filter((c): c is CandidateWithHandle & { instagram_handle: string } => Boolean(c.instagram_handle));
  console.log(`[phase3] ${withHandles.length}/${candidates.length} candidates have Instagram handles`);

  if (withHandles.length === 0) {
    console.warn("[phase3] No handles to scrape — writing pass-through output.");
    await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(candidates, null, 2));
    return;
  }

  const handles = [...new Set(withHandles.map((c) => normalizeHandle(c.instagram_handle)))];
  const client = new ApifyClient({ token });

  console.log(`[phase3] Calling primary actor ${PRIMARY_ACTOR} for ${handles.length} handles…`);
  let followerMap: Map<string, number>;
  try {
    followerMap = await runPrimary(client, handles);
    console.log(`[phase3] Primary actor returned ${followerMap.size} follower counts`);
  } catch (err) {
    console.warn(`[phase3] Primary actor failed (${(err as Error).message}). Trying fallback…`);
    try {
      followerMap = await runFallback(client, handles);
      console.log(`[phase3] Fallback actor returned ${followerMap.size} follower counts`);
    } catch (err2) {
      console.error(`[phase3] Fallback actor also failed: ${(err2 as Error).message}`);
      process.exit(1);
    }
  }

  const missing = handles.filter((h) => !followerMap.has(h));
  if (missing.length > 0 && missing.length < handles.length) {
    console.log(`[phase3] Retrying ${missing.length} missing handles with fallback…`);
    try {
      const fb = await runFallback(client, missing);
      for (const [h, c] of fb) followerMap.set(h, c);
    } catch (err) {
      console.warn(`[phase3] Fallback retry failed (continuing): ${(err as Error).message}`);
    }
  }

  const enriched: OrgWithFollowers[] = candidates.map((c) => {
    if (!c.instagram_handle) return c;
    const count = followerMap.get(normalizeHandle(c.instagram_handle));
    if (typeof count === "number") {
      return { ...c, instagram_followers: count };
    }
    return c;
  });

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(enriched, null, 2));
  console.log(`[phase3] Wrote ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(`[phase3] Fatal: ${(err as Error).message}`);
  process.exit(1);
});
