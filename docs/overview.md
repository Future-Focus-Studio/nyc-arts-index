# Overview

**nyc-arts-index** is a small data pipeline that produces a ranked list of the
top 100 New York City arts organizations by Instagram follower count.

## Goal

Maintain a transparent, reproducible, machine-readable ranking of NYC arts orgs.
The output (`output/nyc-arts-index.json` and `output/nyc-arts-index.md`) is the
deliverable; everything else is plumbing.

## Scope: what counts as an "arts organization"?

The index covers six categories of NYC-based, primarily-public-facing arts
organizations:

| Category | What's in scope |
|---|---|
| `museum` | Museums of art, sculpture, photography, design |
| `gallery` | Commercial galleries, project spaces with regular programming |
| `artist-run-space` | Artist-organized non-commercial spaces |
| `performing-arts` | Opera, ballet, theater, music venues, dance companies |
| `arts-nonprofit` | 501(c)(3) arts orgs (residencies, public art, foundations) |
| `cultural-center` | Multi-disciplinary cultural and community arts centers |

Out of scope: individual artists, art schools (unless the school operates a
public gallery as its primary identity), commercial entertainment (movie
theaters, music labels), arts media publications, and tattoo/design studios.

## Ranking metric: why Instagram followers?

Instagram follower count is **not** a perfect proxy for cultural significance
— it favors visually-oriented and consumer-facing institutions. We use it
because:

1. It's **publicly accessible** and consistently scrapable.
2. It's a **single comparable number** across very different kinds of orgs.
3. It correlates loosely with **public awareness and reach**, which is the
   axis this index is trying to capture (popular visibility, not curatorial
   stature).

For curatorial/critical importance, this list should be read alongside other
signals — it is an indicator, not a verdict.

## Geographic scope

The five boroughs of New York City. Orgs headquartered outside NYC are excluded
even if they program in NYC. Borough is recorded; neighborhood is recorded
when known.

## Refresh cadence

Manual. Re-run the pipeline whenever a fresh snapshot is wanted; results vary
day-to-day with follower fluctuations.
