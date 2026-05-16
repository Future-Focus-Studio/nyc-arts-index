import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { ApifyClient } from "apify-client";
import axios from "axios";
import type { Candidate, Category, Borough } from "./types.js";

const OUTPUT_FILE = "data/phase1-candidates.json";

const SEED_LIST: Candidate[] = [
  { name: "Museum of Modern Art", slug: "moma", website: "https://www.moma.org", category: "museum", neighborhood: "Midtown", borough: "Manhattan", source: "seed" },
  { name: "Guggenheim Museum", slug: "guggenheim", website: "https://www.guggenheim.org", category: "museum", neighborhood: "Upper East Side", borough: "Manhattan", source: "seed" },
  { name: "Whitney Museum of American Art", slug: "whitney", website: "https://whitney.org", category: "museum", neighborhood: "Meatpacking District", borough: "Manhattan", source: "seed" },
  { name: "Brooklyn Museum", slug: "brooklyn-museum", website: "https://www.brooklynmuseum.org", category: "museum", neighborhood: "Prospect Heights", borough: "Brooklyn", source: "seed" },
  { name: "Metropolitan Museum of Art", slug: "met-museum", website: "https://www.metmuseum.org", category: "museum", neighborhood: "Upper East Side", borough: "Manhattan", source: "seed" },
  { name: "New Museum", slug: "new-museum", website: "https://www.newmuseum.org", category: "museum", neighborhood: "Bowery", borough: "Manhattan", source: "seed" },
  { name: "MoMA PS1", slug: "moma-ps1", website: "https://www.moma.org/ps1", category: "museum", neighborhood: "Long Island City", borough: "Queens", source: "seed" },
  { name: "Dia Art Foundation", slug: "dia-art-foundation", website: "https://www.diaart.org", category: "arts-nonprofit", neighborhood: "Chelsea", borough: "Manhattan", source: "seed" },
  { name: "The Shed", slug: "the-shed", website: "https://theshed.org", category: "performing-arts", neighborhood: "Hudson Yards", borough: "Manhattan", source: "seed" },
  { name: "Perelman Performing Arts Center", slug: "pac-nyc", website: "https://pacnyc.org", category: "performing-arts", neighborhood: "Financial District", borough: "Manhattan", source: "seed" },
  { name: "Park Avenue Armory", slug: "park-avenue-armory", website: "https://www.armoryonpark.org", category: "performing-arts", neighborhood: "Upper East Side", borough: "Manhattan", source: "seed" },
  { name: "ICA New York", slug: "ica-ny", website: "https://icany.org", category: "arts-nonprofit", neighborhood: "Long Island City", borough: "Queens", source: "seed" },
  { name: "Artists Space", slug: "artists-space", website: "https://artistsspace.org", category: "artist-run-space", neighborhood: "Tribeca", borough: "Manhattan", source: "seed" },
  { name: "White Columns", slug: "white-columns", website: "https://whitecolumns.org", category: "artist-run-space", neighborhood: "West Village", borough: "Manhattan", source: "seed" },
  { name: "47 Canal", slug: "47-canal", website: "https://www.47canal.us", category: "gallery", neighborhood: "Lower East Side", borough: "Manhattan", source: "seed" },
  { name: "Pioneer Works", slug: "pioneer-works", website: "https://pioneerworks.org", category: "arts-nonprofit", neighborhood: "Red Hook", borough: "Brooklyn", source: "seed" },
  { name: "Socrates Sculpture Park", slug: "socrates-sculpture-park", website: "https://socratessculpturepark.org", category: "arts-nonprofit", neighborhood: "Long Island City", borough: "Queens", source: "seed" },
  { name: "Queens Museum", slug: "queens-museum", website: "https://queensmuseum.org", category: "museum", neighborhood: "Corona", borough: "Queens", source: "seed" },
  { name: "Brooklyn Academy of Music", slug: "bam", website: "https://www.bam.org", category: "performing-arts", neighborhood: "Fort Greene", borough: "Brooklyn", source: "seed", instagram_handle_hint: "brooklynacademy" },
  { name: "Lincoln Center", slug: "lincoln-center", website: "https://www.lincolncenter.org", category: "performing-arts", neighborhood: "Lincoln Square", borough: "Manhattan", source: "seed" },
  { name: "Carnegie Hall", slug: "carnegie-hall", website: "https://www.carnegiehall.org", category: "performing-arts", neighborhood: "Midtown", borough: "Manhattan", source: "seed" },
  { name: "New York City Ballet", slug: "nyc-ballet", website: "https://www.nycballet.com", category: "performing-arts", neighborhood: "Lincoln Square", borough: "Manhattan", source: "seed" },
  { name: "New York Philharmonic", slug: "ny-philharmonic", website: "https://nyphil.org", category: "performing-arts", neighborhood: "Lincoln Square", borough: "Manhattan", source: "seed" },
  { name: "Metropolitan Opera", slug: "met-opera", website: "https://www.metopera.org", category: "performing-arts", neighborhood: "Lincoln Square", borough: "Manhattan", source: "seed" },
  { name: "American Ballet Theatre", slug: "abt", website: "https://www.abt.org", category: "performing-arts", neighborhood: "Midtown", borough: "Manhattan", source: "seed" },
  { name: "Joyce Theater", slug: "joyce-theater", website: "https://www.joyce.org", category: "performing-arts", neighborhood: "Chelsea", borough: "Manhattan", source: "seed" },
  { name: "Dance Theater Workshop", slug: "dance-theater-workshop", category: "performing-arts", neighborhood: "Chelsea", borough: "Manhattan", source: "seed", notes: "Merged into New York Live Arts in 2011" },
  { name: "The Kitchen", slug: "the-kitchen", website: "https://thekitchen.org", category: "performing-arts", neighborhood: "Chelsea", borough: "Manhattan", source: "seed" },
  { name: "Anthology Film Archives", slug: "anthology-film-archives", website: "https://anthologyfilmarchives.org", category: "cultural-center", neighborhood: "East Village", borough: "Manhattan", source: "seed" },
  { name: "Printed Matter", slug: "printed-matter", website: "https://www.printedmatter.org", category: "arts-nonprofit", neighborhood: "Chelsea", borough: "Manhattan", source: "seed" },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferBorough(address: string | undefined): Borough {
  if (!address) return "Unknown";
  const a = address.toLowerCase();
  if (a.includes("brooklyn")) return "Brooklyn";
  if (a.includes("queens") || a.includes("astoria") || a.includes("long island city") || a.includes("flushing")) return "Queens";
  if (a.includes("bronx")) return "Bronx";
  if (a.includes("staten island")) return "Staten Island";
  if (a.includes("manhattan") || a.includes("new york, ny")) return "Manhattan";
  return "Unknown";
}

function inferCategory(name: string, types?: string[]): Category {
  const haystack = [name, ...(types ?? [])].join(" ").toLowerCase();
  if (haystack.includes("museum")) return "museum";
  if (haystack.includes("opera") || haystack.includes("ballet") || haystack.includes("philharmonic") || haystack.includes("symphony") || haystack.includes("theater") || haystack.includes("theatre") || haystack.includes("performing")) return "performing-arts";
  if (haystack.includes("gallery")) return "gallery";
  if (haystack.includes("cultural") || haystack.includes("center")) return "cultural-center";
  return "arts-nonprofit";
}

interface ArtsySearchEdge {
  node?: {
    displayLabel?: string;
    href?: string;
  };
}

interface ArtsySearchResponse {
  data?: {
    searchConnection?: {
      edges?: ArtsySearchEdge[];
    };
  };
}

async function fetchArtsy(): Promise<Candidate[]> {
  const searchQueries = [
    "museum new york city",
    "gallery new york city",
    "arts center new york city",
    "performing arts new york",
    "contemporary art new york",
  ];
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const q of searchQueries) {
    const gql = `{
      searchConnection(query: ${JSON.stringify(q)}, first: 20, entities: [PROFILE]) {
        edges {
          node {
            displayLabel
            href
          }
        }
      }
    }`;
    try {
      const resp = await axios.post<ArtsySearchResponse>(
        "https://metaphysics-cdn.artsy.net/v2",
        { query: gql },
        { timeout: 15000, headers: { "Content-Type": "application/json" } }
      );
      const edges = resp.data?.data?.searchConnection?.edges ?? [];
      for (const edge of edges) {
        const name = edge.node?.displayLabel;
        const href = edge.node?.href;
        if (!name) continue;
        const slug = slugify(name);
        if (seen.has(slug)) continue;
        seen.add(slug);
        out.push({
          name,
          slug,
          website: href ? `https://www.artsy.net${href}` : undefined,
          category: inferCategory(name),
          borough: "Unknown",
          source: "artsy",
        });
      }
    } catch (err) {
      console.warn(`[phase1] Artsy fetch failed for "${q}" (continuing): ${(err as Error).message}`);
    }
  }
  return out;
}

interface GoogleMapsItem {
  title?: string;
  website?: string;
  address?: string;
  categoryName?: string;
  url?: string;
}

async function fetchGoogleMaps(client: ApifyClient): Promise<Candidate[]> {
  const searchTerms = [
    "art museum New York City",
    "art gallery New York City",
    "performing arts center New York City",
    "dance company New York City",
    "theater company New York City",
    "contemporary art center New York City",
  ];
  try {
    const run = await client.actor("compass~crawler-google-places").call({
      searchStringsArray: searchTerms,
      maxCrawledPlacesPerSearch: 40,
      language: "en",
      skipClosedPlaces: true,
    });
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const raw = items as unknown as GoogleMapsItem[];
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const item of raw) {
      if (!item.title) continue;
      const slug = slugify(item.title);
      if (seen.has(slug)) continue;
      seen.add(slug);
      out.push({
        name: item.title,
        slug,
        website: item.website,
        category: inferCategory(item.title, item.categoryName ? [item.categoryName] : []),
        borough: inferBorough(item.address),
        source: "google-maps",
      });
    }
    return out;
  } catch (err) {
    console.warn(`[phase1] Google Maps scrape failed (continuing with empty result): ${(err as Error).message}`);
    return [];
  }
}

function mergeCandidates(...lists: Candidate[][]): Candidate[] {
  const bySlug = new Map<string, Candidate>();
  for (const list of lists) {
    for (const c of list) {
      const existing = bySlug.get(c.slug);
      if (!existing) {
        bySlug.set(c.slug, c);
      } else if (existing.source !== "seed" && c.source === "seed") {
        bySlug.set(c.slug, c);
      } else {
        bySlug.set(c.slug, {
          ...existing,
          website: existing.website ?? c.website,
          neighborhood: existing.neighborhood ?? c.neighborhood,
          borough: existing.borough && existing.borough !== "Unknown" ? existing.borough : c.borough,
        });
      }
    }
  }
  return [...bySlug.values()];
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  if (await fileExists(OUTPUT_FILE)) {
    console.log(`[phase1] ${OUTPUT_FILE} already exists — skipping (already done).`);
    return;
  }
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error("[phase1] APIFY_TOKEN missing in environment.");
    process.exit(1);
  }
  const client = new ApifyClient({ token });

  console.log("[phase1] Loading seed list, Artsy, and Google Maps in parallel…");
  const [artsy, gmaps] = await Promise.all([fetchArtsy(), fetchGoogleMaps(client)]);
  console.log(`[phase1] Seed=${SEED_LIST.length}, Artsy=${artsy.length}, GoogleMaps=${gmaps.length}`);

  const merged = mergeCandidates(SEED_LIST, artsy, gmaps);
  console.log(`[phase1] Merged unique candidates: ${merged.length}`);

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(merged, null, 2));
  console.log(`[phase1] Wrote ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(`[phase1] Fatal: ${(err as Error).message}`);
  process.exit(1);
});
