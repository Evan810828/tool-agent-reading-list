#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Discover new LLM watermark papers by Semantic Scholar keyword search."""

from __future__ import annotations

import argparse
import pathlib

try:
    from s2_common import PAPER_FIELDS, S2Client, merge_candidate_file, normalize_paper
except ImportError:  # Support `python -m scripts.update_new_papers`.
    from .s2_common import PAPER_FIELDS, S2Client, merge_candidate_file, normalize_paper


ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)

DEFAULT_QUERIES = [
    "large language model watermark",
    "\"LLM watermark\"",
    "\"text watermarking\" \"language model\"",
    "\"AI-generated text\" watermark",
    "\"watermark\" \"text generation\"",
    "\"watermark removal\" \"language model\"",
    "\"watermark stealing\" \"language model\"",
    "\"watermark spoofing\" \"language model\"",
    "\"watermark detection\" \"large language model\"",
    "\"robust watermark\" \"large language model\"",
]


def fetch_search(client: S2Client, query: str, max_results: int) -> list[dict]:
    out = []
    offset = 0
    page_size = 100
    while len(out) < max_results:
        limit = min(page_size, max_results - len(out))
        data = client.get(
            "/paper/search",
            params={
                "query": query,
                "limit": limit,
                "offset": offset,
                "fields": PAPER_FIELDS,
            },
        )
        items = data.get("data") or []
        print(f"Query '{query}': fetched {len(items)} items at offset {offset}")
        if not items:
            break
        discovery = {"source": "keyword", "query": query}
        out.extend(normalize_paper(p, discovery=discovery) for p in items)
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
    parser.add_argument("--query", action="append", help="Override default query. Can be passed more than once.")
    parser.add_argument("--max-results-per-query", type=int, default=100)
    parser.add_argument("--delay-seconds", type=float, default=1.1)
    parser.add_argument("--out", default=str(DATA / "candidates_latest.json"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    queries = args.query or DEFAULT_QUERIES
    client = S2Client(delay_seconds=args.delay_seconds)

    all_items = []
    for query in queries:
        all_items.extend(fetch_search(client, query, args.max_results_per_query))

    merge_candidate_file(pathlib.Path(args.out), all_items)
    print(f"Discovered {len(all_items)} raw keyword-search candidates from {len(queries)} queries")


if __name__ == "__main__":
    main()
