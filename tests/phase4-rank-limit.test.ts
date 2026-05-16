import "dotenv/config";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { OrgWithFollowers, RankedOrg } from "../src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

function mkOrg(slug: string, followers: number): OrgWithFollowers {
  return {
    name: `Org ${slug.toUpperCase()}`,
    slug,
    website: `https://${slug}.example`,
    category: "museum",
    neighborhood: "Test",
    borough: "Manhattan",
    source: "seed",
    notes: "",
    instagram_handle: slug,
    instagram_url: `https://www.instagram.com/${slug}/`,
    instagram_followers: followers,
  };
}

async function main(): Promise<void> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "phase4-test-"));
  const inputPath = path.join(tmp, "phase3-with-followers.json");
  const outputPath = path.join(tmp, "nyc-arts-index.json");
  const outputFullPath = path.join(tmp, "nyc-arts-index-full.json");

  const fixture: OrgWithFollowers[] = [
    mkOrg("alpha", 9000),
    mkOrg("bravo", 8000),
    mkOrg("charlie", 7000),
    mkOrg("delta", 6000),
    mkOrg("echo", 5000),
    mkOrg("foxtrot", 4000),
    mkOrg("golf", 3000),
    mkOrg("hotel", 2000),
  ];
  await fs.writeFile(inputPath, JSON.stringify(fixture, null, 2));

  const phase4 = path.join(REPO_ROOT, "src", "phase4-rank.ts");
  const result = spawnSync("npx", ["tsx", phase4], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      RANK_LIMIT: "5",
      PHASE4_INPUT: inputPath,
      PHASE4_OUTPUT: outputPath,
      PHASE4_OUTPUT_FULL: outputFullPath,
    },
    encoding: "utf-8",
  });

  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");

  if (result.status !== 0) {
    throw new Error(`phase4 exited with code ${result.status}`);
  }

  const top: RankedOrg[] = JSON.parse(await fs.readFile(outputPath, "utf-8"));
  const full: RankedOrg[] = JSON.parse(await fs.readFile(outputFullPath, "utf-8"));

  const assertions: Array<[string, boolean]> = [
    ["top has 5 orgs", top.length === 5],
    ["full has 8 orgs", full.length === 8],
    ["top ranks are 1..5", top.every((o, i) => o.rank === i + 1)],
    ["full ranks are 1..8", full.every((o, i) => o.rank === i + 1)],
    ["top sorted desc", top.every((o, i, a) => i === 0 || a[i - 1].instagram_followers >= o.instagram_followers)],
    ["full sorted desc", full.every((o, i, a) => i === 0 || a[i - 1].instagram_followers >= o.instagram_followers)],
    ["top[0] = alpha (9000)", top[0]?.slug === "alpha" && top[0]?.instagram_followers === 9000],
    ["top[4] = echo (5000)", top[4]?.slug === "echo" && top[4]?.instagram_followers === 5000],
    ["full[7] = hotel (2000)", full[7]?.slug === "hotel" && full[7]?.instagram_followers === 2000],
  ];

  let failed = 0;
  for (const [label, ok] of assertions) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
    if (!ok) failed++;
  }

  await fs.rm(tmp, { recursive: true, force: true });

  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll assertions passed.");
}

main().catch((err) => {
  console.error(`[test] Fatal: ${(err as Error).message}`);
  process.exit(1);
});
