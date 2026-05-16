# Data Model

The final ranked output (`output/nyc-arts-index.json`) is an array of
`RankedOrg` records. Intermediate phase outputs use progressively-enriched
variants of the same shape.

## `RankedOrg` (final output)

```ts
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

### Field-by-field

| Field | Type | Notes |
|---|---|---|
| `rank` | `number` | 1-indexed position after sorting; `1` = most followers |
| `name` | `string` | Display name, as it appears publicly |
| `slug` | `string` | URL-safe lowercase identifier; primary dedup key across phases |
| `instagram_handle` | `string` | Username only, no `@`, no URL |
| `instagram_followers` | `number` | Snapshot at time of Phase 3 scrape |
| `instagram_url` | `string` | `https://www.instagram.com/<handle>/` |
| `category` | `Category` | Enum, see below |
| `website` | `string` | Canonical org website; `""` if unknown |
| `neighborhood` | `string` | Free-form (e.g. `"Lower East Side"`); `""` if unknown |
| `borough` | `Borough` | Enum, see below |
| `notes` | `string` | Optional free-form caveats; `""` if none |

### `Category` enum

```
"museum" | "gallery" | "artist-run-space" | "performing-arts" |
"arts-nonprofit" | "cultural-center"
```

See `docs/overview.md` for scope definitions per category.

### `Borough` enum

```
"Manhattan" | "Brooklyn" | "Queens" | "Bronx" | "Staten Island" | "Unknown"
```

`"Unknown"` is used when the discovery source did not provide enough address
detail to infer a borough.

## Intermediate phase shapes

The TypeScript source of truth is `src/types.ts`. In order of enrichment:

- **`Candidate`** (Phase 1 output) — `name`, `slug`, `website?`, `category`,
  `neighborhood?`, `borough?`, `source`, `notes?`. `source` is one of
  `"seed" | "artsy" | "google-maps"`, used for provenance.
- **`CandidateWithHandle`** (Phase 2 output) — `Candidate` + optional
  `instagram_handle` and `instagram_url`.
- **`OrgWithFollowers`** (Phase 3 output) — adds optional
  `instagram_followers`.
- **`RankedOrg`** (Phase 4 output, the public shape) — all fields required;
  no optionals.

The transitions are monotonic: Phase 4 just promotes optional fields to
required (or filters the record out if it can't).
