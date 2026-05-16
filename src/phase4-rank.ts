import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import type { OrgWithFollowers, RankedOrg, Category, Borough } from "./types.js";

const INPUT_FILE = process.env.PHASE4_INPUT ?? "data/phase3-with-followers.json";
const OUTPUT_FILE = process.env.PHASE4_OUTPUT ?? "output/nyc-arts-index.json";

const VALID_CATEGORIES: ReadonlySet<Category> = new Set([
  "museum",
  "gallery",
  "artist-run-space",
  "performing-arts",
  "arts-nonprofit",
  "cultural-center",
]);

const NON_ARTS_BLOCKLIST: ReadonlyArray<string> = [
  "tattoo",
  "real estate",
  "salon",
  "barber",
  "restaurant",
  "cafe ",
  "coffee",
  "store",
  "shop ",
];

function isArtsOrg(org: OrgWithFollowers): boolean {
  if (!VALID_CATEGORIES.has(org.category)) return false;
  const name = org.name.toLowerCase();
  for (const term of NON_ARTS_BLOCKLIST) {
    if (name.includes(term)) return false;
  }
  return true;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export function rankOrgs(input: OrgWithFollowers[], limit = 100): RankedOrg[] {
  const filtered = input
    .filter(isArtsOrg)
    .filter((o): o is OrgWithFollowers & { instagram_handle: string; instagram_followers: number } =>
      Boolean(o.instagram_handle) && typeof o.instagram_followers === "number",
    );

  const sorted = [...filtered].sort((a, b) => b.instagram_followers - a.instagram_followers);
  const top = sorted.slice(0, limit);

  return top.map<RankedOrg>((o, idx) => ({
    rank: idx + 1,
    name: o.name,
    slug: o.slug,
    instagram_handle: o.instagram_handle,
    instagram_followers: o.instagram_followers,
    instagram_url: o.instagram_url ?? `https://www.instagram.com/${o.instagram_handle}/`,
    category: o.category,
    website: o.website ?? "",
    neighborhood: o.neighborhood ?? "",
    borough: (o.borough ?? "Unknown") as Borough,
    notes: o.notes ?? "",
  }));
}

async function main(): Promise<void> {
  if (await fileExists(OUTPUT_FILE)) {
    console.log(`[phase4] ${OUTPUT_FILE} already exists — skipping (already done).`);
    return;
  }
  if (!(await fileExists(INPUT_FILE))) {
    console.error(`[phase4] Missing input ${INPUT_FILE}. Run phase3 first.`);
    process.exit(1);
  }
  const data: OrgWithFollowers[] = JSON.parse(await fs.readFile(INPUT_FILE, "utf-8"));
  console.log(`[phase4] Loaded ${data.length} orgs from ${INPUT_FILE}`);

  const ranked = rankOrgs(data, 100);
  console.log(`[phase4] Ranked top ${ranked.length}`);

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(ranked, null, 2));
  console.log(`[phase4] Wrote ${OUTPUT_FILE}`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error(`[phase4] Fatal: ${(err as Error).message}`);
    process.exit(1);
  });
}
