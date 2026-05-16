# nyc-arts-index

> Top 100 New York City arts organizations, ranked by Instagram follower count.

A small, reproducible Node.js + TypeScript pipeline that discovers NYC arts
orgs, resolves their Instagram handles, scrapes follower counts via Apify,
and emits a ranked JSON + Markdown index.

## Quickstart

```bash
npm install
cp .env.example .env          # then edit .env and set APIFY_TOKEN=...
npm run pipeline
```

Outputs land in `output/`:

- `output/nyc-arts-index.json` — ranked top-N, structured (N defaults to 100)
- `output/nyc-arts-index.md`   — ranked top-N, Markdown table
- `output/nyc-arts-index-full.json` — complete untruncated dataset, every ranked org
- `output/nyc-arts-index-full.md`   — Markdown table of every ranked org

The top-N cutoff is configurable via the `RANK_LIMIT` env var (default `100`).
The `-full` outputs are always written and contain every org with a valid
Instagram follower count, regardless of `RANK_LIMIT`. See
[docs/running.md](docs/running.md) for details.

## Pipeline

```
Phase 1: Discover  ─▶  Phase 2: Handles  ─▶  Phase 3: Followers  ─▶  Phase 4: Rank  ─▶  Phase 5: Markdown
   seed list +           website-content-       instagram-followers-      sort by         render
   Artsy GraphQL +       crawler (cheerio)      count-scraper             followers       table
   Google Maps                                  (+ fallback)              take top 100
```

Each phase reads/writes a checkpoint file under `data/`; re-runs resume from
where the last run left off. See [docs/pipeline.md](docs/pipeline.md) for
the full per-phase breakdown.

## Data model

```json
{
  "rank": 1,
  "name": "Museum of Modern Art",
  "slug": "moma",
  "instagram_handle": "themuseumofmodernart",
  "instagram_followers": 5800000,
  "instagram_url": "https://www.instagram.com/themuseumofmodernart/",
  "category": "museum",
  "website": "https://www.moma.org",
  "neighborhood": "Midtown",
  "borough": "Manhattan",
  "notes": ""
}
```

Categories: `museum` · `gallery` · `artist-run-space` · `performing-arts` ·
`arts-nonprofit` · `cultural-center`.
Full field-by-field reference in [docs/data-model.md](docs/data-model.md).

## Output example

| Rank | Name | Category | Borough | Followers |
|-----:|------|----------|---------|----------:|
| 1 | Museum of Modern Art | museum | Manhattan | 5,800,000 |
| 2 | Metropolitan Museum of Art | museum | Manhattan | … |
| 3 | Whitney Museum of American Art | museum | Manhattan | … |

(Final numbers depend on the live scrape — re-run the pipeline for a fresh
snapshot.)

## Documentation

- [docs/overview.md](docs/overview.md) — goals, scope, ranking-metric rationale
- [docs/pipeline.md](docs/pipeline.md) — phases, inputs/outputs, actors per phase
- [docs/apify-actors.md](docs/apify-actors.md) — actor IDs, fields used, costs, alternatives
- [docs/data-model.md](docs/data-model.md) — field-by-field schema reference
- [docs/running.md](docs/running.md) — install, configure, run, troubleshoot

## Scripts

| Command | What it does |
|---|---|
| `npm run pipeline` | Run all 5 phases in sequence |
| `npm run phase1` … `npm run phase5` | Run one phase |
| `npm run typecheck` | TypeScript check, no emit |
| `npm run build` | Compile to `dist/` |

## License

MIT
