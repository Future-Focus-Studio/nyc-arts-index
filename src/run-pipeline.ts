import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PHASES: Array<{ name: string; file: string }> = [
  { name: "phase1", file: "phase1-discover.ts" },
  { name: "phase2", file: "phase2-resolve-handles.ts" },
  { name: "phase3", file: "phase3-scrape-followers.ts" },
  { name: "phase4", file: "phase4-rank.ts" },
  { name: "phase5", file: "phase5-output.ts" },
];

function runStep(file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", path.join(__dirname, file)], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

async function main(): Promise<void> {
  if (!process.env.APIFY_TOKEN) {
    console.error("[pipeline] APIFY_TOKEN missing in environment. Set it in .env.");
    process.exit(1);
  }
  for (const phase of PHASES) {
    console.log(`\n=== ${phase.name} ===`);
    try {
      await runStep(phase.file);
    } catch (err) {
      console.error(`[pipeline] ${phase.name} failed: ${(err as Error).message}`);
      process.exit(1);
    }
  }
  console.log("\n[pipeline] All phases complete. Outputs in ./output/");
}

main();
