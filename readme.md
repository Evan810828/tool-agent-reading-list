# LLM Agent Reading List

Static GitHub Pages site with an auto-curated reading list for recent LLM agent research, especially tool use, planning, agent trajectories, evaluation, reliability, uncertainty, calibration, benchmarks, and safety.

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

4. Optional but recommended: set `S2_API_KEY` for Semantic Scholar API access.

## Workflow

- **Discover new papers**: `uv run python scripts/update_new_papers.py` -> `data/candidates_latest.json`.
- **Find new citations to seeds**: edit `seeds/important_papers.yaml`, then `uv run python scripts/update_citations.py` -> `data/candidates_citations.json`.
- **Curate**: for papers you accept, create `/articles/<slug>.yaml` and fill metadata.
- **Publish curated list**: `uv run python scripts/build_index.py` -> updates `data/index.json`.
- **View**: Reading List -> browse `All` papers, filter by auto-curated categories, or search paper metadata and abstracts.

## Default Keyword Queries

`scripts/update_new_papers.py` uses:

```python
DEFAULT_QUERIES = [
    "\"tool agent\" reliability",
    "\"tool agent\" verification",
    "\"tool agent\" verifier",
    "\"tool agent\" failure detection",
    "\"tool agent\" monitoring",
    "\"LLM agent\" reliability",
    "\"LLM agent\" verification",
    "\"LLM agent\" verifier",
    "\"LLM agent\" failure detection",
    "\"AI agent\" reliability",
    "\"AI agent\" verification",
    "\"agent trajectory\" verification",
    "\"agent trajectory\" verifier",
    "\"agent trajectory\" failure detection",
    "\"process reward model\" \"LLM agent\"",
    "\"selective prediction\" \"LLM agent\"",
]
```

## Content Files

- `articles/*.yaml`: curated reading-list papers.
- `data/*.json`: generated reading-list data consumed by the static page.
- `seeds/important_papers.yaml`: seed papers for citation-following discovery.
- `assets/app.js` and `assets/style.css`: client-side rendering and visual design.

## Paper YAML Schema

```yaml
id: unique-slug
title: "Paper title"
authors: ["Alice", "Bob"]
year: 2026
venue: "ArXiv"
url: https://...
arxivId: 2601.01234 # optional
tags: [verification, monitoring, tool use]
abstract: >-
  One-paragraph abstract.
source: manual|semantic_scholar
addedAt: 2026-07-05
citationCount: 12 # optional
```
