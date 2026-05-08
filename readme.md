
# LLM Watermark Hub

Static GitHub Pages site with manual updater scripts for LLM watermark research, project notes, and a personal academic profile.

## Fast Start

1. Enable GitHub Pages from **Settings -> Pages -> Branch: main, / (root)**.
2. Install the Python script environment:

```bash
uv sync
```

3. Preview the static site locally:

```bash
python -m http.server 8000
```

4. Strongly recommended: get a Semantic Scholar API key and expose it as `S2_API_KEY`.
   The scripts include retry/backoff, but unauthenticated requests are easy to rate-limit.

## Daily Workflow

- **Discover new papers**: `uv run python scripts/update_new_papers.py` -> `data/candidates_latest.json`.
- **Find new citations to seeds**: edit `seeds/important_papers.yaml`, then `uv run python scripts/update_citations.py` -> `data/candidates_citations.json`.
- **Curate**: for papers you accept, create `/articles/<slug>.yaml` and fill metadata.
- **Publish formal list**: `uv run python scripts/build_index.py` -> updates `data/index.json`.
  The builder refuses to shrink an existing index unless you set `ALLOW_INDEX_SHRINK=1`, which protects the published list when only a subset of article YAML files is present locally.
- **View**: Reading List -> choose `Curated`, `Latest (Keyword Search)`, or `Latest (Citations to Seeds)`.

## Discovery Scripts

The updater scripts share `scripts/s2_common.py`, which handles:

- Semantic Scholar request throttling, retries, and clearer API errors.
- Paper normalization into a stable site-friendly schema.
- Stronger de-duplication by `paperId`, then arXiv ID, DOI, then normalized title/year.
- Merge behavior that preserves manually added fields such as `tags`, `notes`, `status`, and `decision`.
- `discoveredBy` provenance so a candidate can record multiple keyword or citation paths.

Useful options:

```bash
uv run python scripts/update_new_papers.py \
  --query "LLM watermark" \
  --max-results-per-query 50

uv run python scripts/update_citations.py \
  --max-citations-per-seed 500
```

For citation discovery, prefer adding stable Semantic Scholar paper IDs to `seeds/important_papers.yaml`; title search is used only as a fallback.

## Content Files

- `articles/*.yaml`: curated reading-list papers.
- `data/*.json`: generated reading-list data consumed by the static page.
- `projects/projects.json`: project metadata shown on the Projects tab.
- `projects/ndss26/char-ndss-en.md`: long-form project description for the featured NDSS project.
- `assets/app.js` and `assets/style.css`: client-side rendering and visual design.

## Paper YAML Schema

Files live under `/articles`.

```yaml
id: unique-slug
title: "Paper title"
authors: ["Alice", "Bob"]
year: 2025
venue: "ArXiv" # or conf/journal
url: https://...
arxivId: 2501.01234 # optional
tags: [attack, defense, survey, eval]
abstract: >-
  One-paragraph abstract.
source: manual|semantic_scholar
addedAt: 2025-09-28
citationCount: 12 # optional
```

## Future Ideas

- Per-paper pages generated from YAML to `/papers/<id>.html`.
- RSS/Atom feed from the curated list.
- BibTeX/CSV export for curated papers.
