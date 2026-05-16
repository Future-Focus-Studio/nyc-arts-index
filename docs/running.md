# Running the Pipeline

## Prerequisites

- Node.js ≥ 20
- An Apify account and an API token (https://console.apify.com/account/integrations)

## Install

```bash
git clone https://github.com/Future-Focus-Studio/nyc-arts-index.git
cd nyc-arts-index
npm install
```

## Configure

Copy the example env file and fill in your token:

```bash
cp .env.example .env
# Edit .env so it reads: APIFY_TOKEN=apify_api_...
```

## Run the full pipeline

```bash
npm run pipeline
```

This runs Phase 1 → 2 → 3 → 4 → 5 in sequence. Each phase writes a
checkpoint file; the pipeline stops on the first failure. Re-run the same
command to resume from the last successful phase (the orchestrator skips
phases whose output file already exists).

Final outputs:

- `output/nyc-arts-index.json` — ranked top-100 JSON
- `output/nyc-arts-index.md` — Markdown table

## Run an individual phase

```bash
npm run phase1
npm run phase2
npm run phase3
npm run phase4
npm run phase5
```

Each script can also be run directly with `npx tsx src/phaseN-*.ts`.

## Force a re-run

The checkpoint behavior means re-runs are no-ops if the output exists. To
force a phase to re-execute, delete its output file first:

```bash
rm data/phase2-with-handles.json
npm run phase2
```

To force the full pipeline:

```bash
rm -rf data/ output/
npm run pipeline
```

## Where things land

| Path | Purpose | Tracked in git? |
|---|---|---|
| `data/phase1-candidates.json` | Phase 1 checkpoint | no |
| `data/phase2-with-handles.json` | Phase 2 checkpoint | no |
| `data/phase3-with-followers.json` | Phase 3 checkpoint | no |
| `output/nyc-arts-index.json` | Final ranked JSON | **yes** |
| `output/nyc-arts-index.md` | Final Markdown table | **yes** |

## Type-check only

```bash
npm run typecheck
```

## Troubleshooting

- **`APIFY_TOKEN missing in environment`** — make sure your `.env` file
  exists in the project root and contains `APIFY_TOKEN=...`.
- **Phase 2 returns zero handles** — likely an Apify quota / token issue.
  Check the run in https://console.apify.com/actors/runs.
- **Phase 3 primary actor errors** — the script auto-falls-back to
  `apify/instagram-scraper`. If both fail, the run exits with code 1.
