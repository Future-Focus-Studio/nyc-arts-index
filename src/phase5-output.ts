import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import type { RankedOrg } from "./types.js";

const INPUT_FILE = process.env.PHASE5_INPUT ?? "output/nyc-arts-index.json";
const OUTPUT_FILE = process.env.PHASE5_OUTPUT ?? "output/nyc-arts-index.md";

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

export function renderMarkdown(orgs: RankedOrg[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push("# NYC Arts Index — Top 100");
  lines.push("");
  lines.push(`_Ranked by Instagram follower count. Generated ${today}._`);
  lines.push("");
  lines.push("| Rank | Name | Category | Borough | Followers | Instagram | Website |");
  lines.push("|-----:|------|----------|---------|----------:|-----------|---------|");
  for (const o of orgs) {
    const ig = `[@${o.instagram_handle}](${o.instagram_url})`;
    const web = o.website ? `[link](${o.website})` : "—";
    lines.push(
      `| ${o.rank} | ${o.name} | ${o.category} | ${o.borough} | ${fmtNum(o.instagram_followers)} | ${ig} | ${web} |`,
    );
  }
  lines.push("");
  lines.push(`_Total orgs ranked: ${orgs.length}_`);
  lines.push("");
  return lines.join("\n");
}

async function main(): Promise<void> {
  if (!(await fileExists(INPUT_FILE))) {
    console.error(`[phase5] Missing input ${INPUT_FILE}. Run phase4 first.`);
    process.exit(1);
  }
  const orgs: RankedOrg[] = JSON.parse(await fs.readFile(INPUT_FILE, "utf-8"));
  const md = renderMarkdown(orgs);
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, md);
  console.log(`[phase5] Wrote ${OUTPUT_FILE} (${orgs.length} rows)`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error(`[phase5] Fatal: ${(err as Error).message}`);
    process.exit(1);
  });
}
