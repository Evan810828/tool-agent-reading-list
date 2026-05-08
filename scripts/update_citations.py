#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Discover papers that cite important seed papers."""

from __future__ import annotations

import argparse
import pathlib

import yaml

try:
    from s2_common import CITING_PAPER_FIELDS, S2Client, merge_candidate_file, normalize_paper, normalize_title
except ImportError:  # Support `python -m scripts.update_citations`.
    from .s2_common import CITING_PAPER_FIELDS, S2Client, merge_candidate_file, normalize_paper, normalize_title


ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)
SEEDS = ROOT / "seeds" / "important_papers.yaml"


def load_seeds(path: pathlib.Path) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        payload = yaml.safe_load(f) or {}
    return payload.get("seeds") or []


def resolve_seed(client: S2Client, seed: dict) -> tuple[str | None, str]:
    title = seed.get("title") or ""
    if seed.get("s2PaperId"):
        return seed["s2PaperId"], title

    data = client.get(
        "/paper/search",
        params={
            "query": title,
            "limit": 5,
            "fields": "paperId,title,year,externalIds",
        },
    )
    candidates = data.get("data") or []
    if not candidates:
        print(f"Seed '{title}': no Semantic Scholar match")
        return None, title

    title_norm = normalize_title(title)
    exact = [p for p in candidates if normalize_title(p.get("title")) == title_norm]
    chosen = (exact or candidates)[0]
    if not exact:
        print(f"Seed '{title}': using closest match '{chosen.get('title')}' ({chosen.get('paperId')})")
    return chosen.get("paperId"), title


def fetch_citations(client: S2Client, seed: dict, max_citations: int) -> list[dict]:
    seed_id, seed_title = resolve_seed(client, seed)
    if not seed_id:
        return []

    out = []
    offset = 0
    page_size = 100
    while len(out) < max_citations:
        limit = min(page_size, max_citations - len(out))
        data = client.get(
            f"/paper/{seed_id}/citations",
            params={
                "fields": CITING_PAPER_FIELDS,
                "limit": limit,
                "offset": offset,
            },
        )
        items = data.get("data") or []
        print(f"Seed '{seed_title}' ({seed_id}): fetched {len(items)} citations at offset {offset}")
        if not items:
            break
        discovery = {"source": "citation", "seedTitle": seed_title, "seedPaperId": seed_id}
        for citation in items:
            citing = citation.get("citingPaper") or {}
            out.append(
                normalize_paper(
                    citing,
                    discovery=discovery,
                    seed_title=seed_title,
                    seed_paper_id=seed_id,
                )
            )
        next_offset = data.get("next")
        if next_offset is None:
            if len(items) < limit:
                break
            offset += len(items)
        else:
            offset = int(next_offset)
    return out


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seeds", default=str(SEEDS))
    parser.add_argument("--out", default=str(DATA / "candidates_citations.json"))
    parser.add_argument("--max-citations-per-seed", type=int, default=1000)
    parser.add_argument("--delay-seconds", type=float, default=1.1)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    client = S2Client(delay_seconds=args.delay_seconds)
    seeds = load_seeds(pathlib.Path(args.seeds))

    all_items = []
    for seed in seeds:
        all_items.extend(fetch_citations(client, seed, args.max_citations_per_seed))

    merge_candidate_file(pathlib.Path(args.out), all_items)
    print(f"Discovered {len(all_items)} raw citation candidates from {len(seeds)} seeds")


if __name__ == "__main__":
    main()
