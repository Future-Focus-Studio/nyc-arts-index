# Pipeline

The pipeline is five sequential phases. Each phase reads its input from the
previous phase's output file and writes its own output. Phases are
**resumable**: if the output file already exists, the phase logs "already
done" and exits.

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Phase 1  │──▶ │ Phase 2  │──▶ │ Phase 3  │──▶ │ Phase 4  │──▶ │ Phase 5  │
│ Discover │    │ Handles  │    │ Followers│    │ Rank     │    │ Markdown │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │              │                │                │                │
     ▼              ▼                ▼                ▼                ▼
phase1-         phase2-           phase3-         output/          output/
candidates     with-handles    with-followers   nyc-arts-        nyc-arts-
.json          .json           .json            index.json        index.md
                                                 + -full.json      + -full.md
```

## Phase 1 — Discovery

**Script:** `src/phase1-discover.ts`
**Input:** none
**Output:** `data/phase1-candidates.json`

Assembles ~200–300 NYC arts org candidates from three sources, merged and
deduplicated by slug:

1. **Curated seed list** — 30 hardcoded well-known orgs (in the source file).
   These always appear in the candidate list regardless of API results.
2. **Artsy GraphQL API** — public partner data from `metaphysics-cdn.artsy.net`,
   `GALLERY` partners within 25 miles of NYC.
3. **Apify Google Maps Scraper** (`apify/google-maps-scraper`) — searches like
   "art museum New York", "art gallery Brooklyn", etc.

If either API source fails, the phase logs a warning and continues with what
it has. The seed list is the floor — the pipeline always proceeds.

## Phase 2 — Handle Resolution

**Script:** `src/phase2-resolve-handles.ts`
**Input:** `data/phase1-candidates.json`
**Output:** `data/phase2-with-handles.json`

For each candidate with a website, crawl the homepage using the Apify
**Website Content Crawler** (`apify/website-content-crawler`) in `cheerio`
mode (fast, no headless browser). Extract Instagram handles from the
page text/HTML using a regex that matches `instagram.com/<handle>` and
filters out reserved paths (`/p/`, `/explore`, etc.).

Candidates without a website pass through with no handle and will be excluded
in Phase 4.

## Phase 3 — Follower Scraping

**Script:** `src/phase3-scrape-followers.ts`
**Input:** `data/phase2-with-handles.json`
**Output:** `data/phase3-with-followers.json`

All resolved handles are batched into a single call to the primary actor:

- **Primary:** `scrapebase/instagram-followers-count-scraper` — lightweight,
  cheap, returns just the follower count per username.
- **Fallback:** `apify/instagram-scraper` — fuller profile scrape; used when
  the primary actor fails entirely, and also retried for any handles missing
  from the primary result.

The phase merges the follower counts back into the candidate records.

## Phase 4 — Rank & Filter

**Script:** `src/phase4-rank.ts`
**Input:** `data/phase3-with-followers.json`
**Outputs:**
- `output/nyc-arts-index.json` — top N (respects `RANK_LIMIT`)
- `output/nyc-arts-index-full.json` — every ranked org, no cutoff

Filters and sorts:

1. Drop any org with a non-arts `category`.
2. Drop any org whose name matches the non-arts blocklist (tattoo, restaurant,
   etc.) — guards against Google Maps false-positives.
3. Drop orgs missing an Instagram handle or follower count.
4. Sort by `instagram_followers` descending.
5. Assign `rank: 1..N` over the full ranked set, then slice the top N for the
   primary output. Both files carry the same `rank` numbering.

### Configuration

| Env var | Default | Purpose |
|---|---|---|
| `RANK_LIMIT` | `100` | Cutoff for the primary `nyc-arts-index.json`. The full file (`nyc-arts-index-full.json`) is always written with every ranked org regardless of this value. |

## Phase 5 — Output

**Script:** `src/phase5-output.ts`
**Inputs:**
- `output/nyc-arts-index.json` (top N)
- `output/nyc-arts-index-full.json` (all orgs)

**Outputs:**
- `output/nyc-arts-index.md` — Markdown table for the top N
- `output/nyc-arts-index-full.md` — Markdown table for the full ranked set

Renders the JSON as a Markdown table with rank, name, category, borough,
follower count, Instagram link, and website link.

## Orchestrator

**Script:** `src/run-pipeline.ts`

Runs all five phases in sequence via child processes. Aborts with non-zero
exit code on the first failing phase. Because each phase is resumable, you
can re-run after a failure and it will pick up where it left off.
