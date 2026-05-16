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
  { name: "El Museo del Barrio", slug: "el-museo-del-barrio", website: "https://www.elmuseo.org", category: "museum", neighborhood: "East Harlem", borough: "Manhattan", source: "seed", instagram_handle_hint: "elmuseo" },
  { name: "Studio Museum in Harlem", slug: "studio-museum-harlem", website: "https://www.studiomuseum.org", category: "museum", neighborhood: "Harlem", borough: "Manhattan", source: "seed", instagram_handle_hint: "studiomuseum" },
  { name: "Museum of Arts and Design", slug: "museum-of-arts-and-design", website: "https://madmuseum.org", category: "museum", neighborhood: "Columbus Circle", borough: "Manhattan", source: "seed", instagram_handle_hint: "madmuseum" },
  { name: "Noguchi Museum", slug: "noguchi-museum", website: "https://www.noguchi.org", category: "museum", neighborhood: "Long Island City", borough: "Queens", source: "seed", instagram_handle_hint: "noguchi_museum" },
  { name: "Museum of the Moving Image", slug: "museum-of-the-moving-image", website: "https://movingimage.us", category: "museum", neighborhood: "Astoria", borough: "Queens", source: "seed", instagram_handle_hint: "movingimage" },
  { name: "Bronx Museum of the Arts", slug: "bronx-museum", website: "https://www.bronxmuseum.org", category: "museum", neighborhood: "Concourse", borough: "Bronx", source: "seed", instagram_handle_hint: "bronxmuseumofthearts" },
  { name: "New York Historical Society", slug: "nyhistory", website: "https://www.nyhistory.org", category: "museum", neighborhood: "Upper West Side", borough: "Manhattan", source: "seed", instagram_handle_hint: "nyhistory" },
  { name: "Brooklyn Botanic Garden", slug: "brooklyn-botanic-garden", website: "https://www.bbg.org", category: "cultural-center", neighborhood: "Crown Heights", borough: "Brooklyn", source: "seed" },
  { name: "Jazz at Lincoln Center", slug: "jazz-at-lincoln-center", website: "https://www.jazz.org", category: "performing-arts", neighborhood: "Columbus Circle", borough: "Manhattan", source: "seed", instagram_handle_hint: "jazzatlincolncenter" },
  { name: "Second Stage Theatre", slug: "second-stage-theatre", website: "https://www.2st.com", category: "performing-arts", neighborhood: "Midtown", borough: "Manhattan", source: "seed", instagram_handle_hint: "2ndstage" },
  { name: "Playwrights Horizons", slug: "playwrights-horizons", website: "https://www.playwrightshorizons.org", category: "performing-arts", neighborhood: "Hell's Kitchen", borough: "Manhattan", source: "seed", instagram_handle_hint: "playwrightshorizons" },
  { name: "Roundabout Theatre Company", slug: "roundabout-theatre-company", website: "https://www.roundabouttheatre.org", category: "performing-arts", neighborhood: "Midtown", borough: "Manhattan", source: "seed", instagram_handle_hint: "roundaboutnyc" },
  { name: "The Public Theater", slug: "public-theater", website: "https://publictheater.org", category: "performing-arts", neighborhood: "East Village", borough: "Manhattan", source: "seed", instagram_handle_hint: "thepublictheater" },
  { name: "Atlantic Theater Company", slug: "atlantic-theater-company", website: "https://atlantictheater.org", category: "performing-arts", neighborhood: "Chelsea", borough: "Manhattan", source: "seed", instagram_handle_hint: "atlantictheaterco" },
  { name: "Manhattan Theatre Club", slug: "manhattan-theatre-club", website: "https://www.manhattantheatreclub.com", category: "performing-arts", neighborhood: "Midtown", borough: "Manhattan", source: "seed", instagram_handle_hint: "manhattantheatreclub" },
  { name: "New York Theatre Workshop", slug: "new-york-theatre-workshop", website: "https://www.nytw.org", category: "performing-arts", neighborhood: "East Village", borough: "Manhattan", source: "seed", instagram_handle_hint: "nytw" },
  { name: "Signature Theatre", slug: "signature-theatre", website: "https://www.signaturetheatre.org", category: "performing-arts", neighborhood: "Midtown", borough: "Manhattan", source: "seed", instagram_handle_hint: "signaturetheatre" },
  { name: "Alvin Ailey American Dance Theater", slug: "alvin-ailey", website: "https://www.alvinailey.org", category: "performing-arts", neighborhood: "Hell's Kitchen", borough: "Manhattan", source: "seed", instagram_handle_hint: "alvinailey" },
  { name: "Paul Taylor Dance Company", slug: "paul-taylor-dance-company", website: "https://www.ptdc.org", category: "performing-arts", neighborhood: "Lower East Side", borough: "Manhattan", source: "seed", instagram_handle_hint: "ptdc_dance" },
  { name: "New York Live Arts", slug: "new-york-live-arts", website: "https://newyorklivearts.org", category: "performing-arts", neighborhood: "Chelsea", borough: "Manhattan", source: "seed", instagram_handle_hint: "newyorklivearts" },
  { name: "Harlem Stage", slug: "harlem-stage", website: "https://www.harlemstage.org", category: "performing-arts", neighborhood: "Harlem", borough: "Manhattan", source: "seed", instagram_handle_hint: "harlemstage" },
  { name: "Diverse Works", slug: "diverse-works", website: "https://diverseworks.org", category: "arts-nonprofit", borough: "Unknown", source: "seed" },
  { name: "ChaShaMa", slug: "chashama", website: "https://chashamaarts.org", category: "arts-nonprofit", borough: "Manhattan", source: "seed", instagram_handle_hint: "chashamaarts" },
  { name: "Flux Factory", slug: "flux-factory", website: "https://www.fluxfactory.org", category: "artist-run-space", neighborhood: "Long Island City", borough: "Queens", source: "seed", instagram_handle_hint: "fluxfactory" },
  { name: "Smack Mellon", slug: "smack-mellon", website: "https://www.smackmellon.org", category: "arts-nonprofit", neighborhood: "DUMBO", borough: "Brooklyn", source: "seed", instagram_handle_hint: "smackmellon" },
  { name: "BRIC", slug: "bric", website: "https://www.bricartsmedia.org", category: "cultural-center", neighborhood: "Downtown Brooklyn", borough: "Brooklyn", source: "seed", instagram_handle_hint: "bricartsmedia" },
  { name: "Interference Archive", slug: "interference-archive", website: "https://interferencearchive.org", category: "arts-nonprofit", neighborhood: "Gowanus", borough: "Brooklyn", source: "seed", instagram_handle_hint: "interferencearchive" },
  { name: "Red Bull Arts New York", slug: "red-bull-arts-new-york", website: "https://www.redbull.com/us-en/arts/new-york", category: "arts-nonprofit", borough: "Manhattan", source: "seed", instagram_handle_hint: "redbullartsnyc" },
  { name: "LMCC", slug: "lmcc", website: "https://lmcc.net", category: "arts-nonprofit", neighborhood: "Governors Island", borough: "Manhattan", source: "seed", instagram_handle_hint: "lmcc_nyc" },
  { name: "Wave Hill", slug: "wave-hill", website: "https://www.wavehill.org", category: "cultural-center", neighborhood: "Riverdale", borough: "Bronx", source: "seed", instagram_handle_hint: "wavehillnyc" },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDomain(website: string | undefined): string | undefined {
  if (!website) return undefined;
  try {
    const u = new URL(website);
    let host = u.hostname.toLowerCase().replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length > 2) {
      host = parts.slice(-2).join(".");
    }
    return host;
  } catch {
    return undefined;
  }
}

function sourcePriority(source: Candidate["source"]): number {
  if (source === "seed") return 0;
  if (source === "artsy") return 1;
  return 2;
}

function completenessScore(c: Candidate): number {
  let n = 0;
  if (c.website) n++;
  if (c.neighborhood) n++;
  if (c.borough && c.borough !== "Unknown") n++;
  if (c.instagram_handle_hint) n++;
  if (c.notes) n++;
  return n;
}

function preferCandidate(a: Candidate, b: Candidate): Candidate {
  const sa = sourcePriority(a.source);
  const sb = sourcePriority(b.source);
  if (sa !== sb) return sa < sb ? a : b;
  const ca = completenessScore(a);
  const cb = completenessScore(b);
  if (ca !== cb) return ca > cb ? a : b;
  return a;
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
    "new york museum",
    "new york gallery",
    "new york arts",
    "brooklyn arts",
    "manhattan gallery",
  ];
  const seenSlug = new Set<string>();
  const seenHref = new Set<string>();
  const out: Candidate[] = [];
  for (const q of searchQueries) {
    const gql = `{
      searchConnection(query: ${JSON.stringify(q)}, first: 40, entities: [PROFILE]) {
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
        if (href && seenHref.has(href)) continue;
        const slug = slugify(name);
        if (seenSlug.has(slug)) continue;
        seenSlug.add(slug);
        if (href) seenHref.add(href);
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
    "contemporary art gallery New York City",
    "performing arts center New York City",
    "dance company New York City",
    "theater company New York City",
    "opera company New York City",
    "symphony orchestra New York City",
    "ballet company New York City",
    "cultural center New York City",
    "arts nonprofit New York City",
    "artist residency New York City",
    "sculpture park New York City",
    "film archive New York City",
    "art foundation New York City",
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

function dedupByNormalizedName(candidates: Candidate[]): { kept: Candidate[]; removed: number } {
  const byKey = new Map<string, Candidate>();
  let removed = 0;
  for (const c of candidates) {
    const key = normalizeName(c.name);
    if (!key) {
      byKey.set(`__empty__${byKey.size}`, c);
      continue;
    }
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, c);
    } else {
      byKey.set(key, preferCandidate(existing, c));
      removed++;
    }
  }
  return { kept: [...byKey.values()], removed };
}

function dedupByDomain(candidates: Candidate[]): { kept: Candidate[]; removed: number } {
  const byKey = new Map<string, Candidate>();
  const noDomain: Candidate[] = [];
  let removed = 0;
  for (const c of candidates) {
    const domain = normalizeDomain(c.website);
    if (!domain) {
      noDomain.push(c);
      continue;
    }
    const existing = byKey.get(domain);
    if (!existing) {
      byKey.set(domain, c);
    } else {
      byKey.set(domain, preferCandidate(existing, c));
      removed++;
    }
  }
  return { kept: [...byKey.values(), ...noDomain], removed };
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
  console.log(`[phase1] Merged unique candidates (by slug): ${merged.length}`);

  const nameDedup = dedupByNormalizedName(merged);
  console.log(`[phase1] Name dedup: removed ${nameDedup.removed}, kept ${nameDedup.kept.length}`);

  const domainDedup = dedupByDomain(nameDedup.kept);
  console.log(`[phase1] Domain dedup: removed ${domainDedup.removed}, kept ${domainDedup.kept.length}`);

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(domainDedup.kept, null, 2));
  console.log(`[phase1] Wrote ${OUTPUT_FILE} (${domainDedup.kept.length} candidates)`);
}

main().catch((err) => {
  console.error(`[phase1] Fatal: ${(err as Error).message}`);
  process.exit(1);
});
