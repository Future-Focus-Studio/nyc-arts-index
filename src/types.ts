export type Category =
  | "museum"
  | "gallery"
  | "artist-run-space"
  | "performing-arts"
  | "arts-nonprofit"
  | "cultural-center";

export type Borough =
  | "Manhattan"
  | "Brooklyn"
  | "Queens"
  | "Bronx"
  | "Staten Island"
  | "Unknown";

export interface Candidate {
  name: string;
  slug: string;
  website?: string;
  category: Category;
  neighborhood?: string;
  borough?: Borough;
  source: "seed" | "artsy" | "google-maps";
  notes?: string;
  instagram_handle_hint?: string;
}

export interface CandidateWithHandle extends Candidate {
  instagram_handle?: string;
  instagram_url?: string;
}

export interface OrgWithFollowers extends CandidateWithHandle {
  instagram_followers?: number;
}

export interface RankedOrg {
  rank: number;
  name: string;
  slug: string;
  instagram_handle: string;
  instagram_followers: number;
  instagram_url: string;
  category: Category;
  website: string;
  neighborhood: string;
  borough: Borough;
  notes: string;
}
