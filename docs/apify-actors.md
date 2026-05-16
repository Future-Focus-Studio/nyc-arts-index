# Apify Actors

This pipeline depends on three Apify actors. All are called via the
[`apify-client`](https://www.npmjs.com/package/apify-client) npm package using
the `APIFY_TOKEN` environment variable.

## `apify/google-maps-scraper`

**Phase:** 1 (discovery)
**Purpose:** Find arts orgs near NYC using Google Maps search queries.
**Input:** array of `searchStringsArray`, plus `locationQuery: "New York, NY"`.
**Output (per item):**

| Field | Used? |
|---|---|
| `title` | yes — org name |
| `website` | yes |
| `address` | yes — borough inference |
| `neighborhood` | yes |
| `categoryName` / `categories` | yes — category inference |
| `phone`, `rating`, `reviews`, `openingHours`, etc. | ignored |

**Cost estimate:** ~$7 per 1,000 places scraped. The pipeline pulls ~200
places across 5 search terms ⇒ ~$1.50 per run.

**Alternatives:**
- `compass/crawler-google-places` — similar, sometimes faster.
- `apify/yelp-scraper` — different source; would need separate category mapping.

## `apify/website-content-crawler`

**Phase:** 2 (handle resolution)
**Purpose:** Crawl each candidate's homepage and extract Instagram handles
from the page's HTML and text.
**Input:**
```json
{
  "startUrls": [{ "url": "..." }],
  "crawlerType": "cheerio",
  "maxCrawlDepth": 1,
  "maxCrawlPages": <2x candidates>,
  "maxConcurrency": 10
}
```
**Output (per item):** `url`, `loadedUrl`, `text`, `html`. We regex
`instagram.com/<handle>` out of either.

**Cost estimate:** ~$0.40 per 1,000 pages in cheerio mode; ~$0.20 per run.

**Alternatives:**
- `apify/cheerio-scraper` — lower-level, more setup.
- Direct `axios.get` of each homepage — free but bypasses anti-bot mitigation;
  we use Apify for reliability.

## `scrapebase/instagram-followers-count-scraper` (primary)

**Phase:** 3 (follower scraping)
**Purpose:** Return follower counts for a batch of Instagram usernames in a
single run. Designed to be cheap and fast — does not return posts or any
profile detail beyond what's needed.
**Input:** `{ "usernames": ["handle1", "handle2", ...] }`
**Output (per item):** at minimum `username` + a numeric follower count under
one of `followersCount`, `followers`, or `followerCount` (the phase tolerates
the variation).

**Cost estimate:** very low — typically pennies per 100 handles.

## `apify/instagram-scraper` (fallback)

**Phase:** 3 (follower scraping, retry path)
**Purpose:** Used (a) when the primary actor fails entirely, and (b) per-handle
re-tries for handles missing from the primary's output. Returns full profile
detail including follower count.
**Input:** `{ "usernames": [...], "resultsType": "details", "resultsLimit": 1 }`
**Output:** profile records — same `username` + follower count fields the
primary returns, plus much more we ignore.

**Cost estimate:** ~$2.30 per 1,000 profiles.

## Why two Instagram actors?

The `scrapebase` actor is purpose-built for follower counts and is
substantially cheaper at scale. The official `apify/instagram-scraper` is the
more battle-tested fallback when the cheap actor fails. The pipeline tries
the cheap one first, falls back automatically, and surfaces a clear error if
both fail.
