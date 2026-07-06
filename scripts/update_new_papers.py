#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Discover new tool-agent reliability papers by Semantic Scholar keyword search."""

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

# DEFAULT_QUERIES = [
#     "\"tool agent\" reliability",
#     "\"tool agent\" verification",
#     "\"tool agent\" verifier",
#     "\"tool agent\" failure detection",
#     "\"tool agent\" monitoring",
#     "\"LLM agent\" reliability",
#     "\"LLM agent\" verification",
#     "\"LLM agent\" verifier",
#     "\"LLM agent\" failure detection",
#     "\"AI agent\" reliability",
#     "\"AI agent\" verification",
#     "\"agent trajectory\" verification",
#     "\"agent trajectory\" verifier",
#     "\"agent trajectory\" failure detection",
#     "\"process reward model\" \"LLM agent\"",
#     "\"selective prediction\" \"LLM agent\"",
# ]

DEFAULT_QUERIES = [
    # Budget- and cost-aware agents
    "\"budget-aware\" \"LLM agent\"",
    "\"budget-aware\" agent tool use",
    "\"cost-aware\" \"LLM agent\"",
    "\"cost-aware\" exploration agent",
    "\"tool-call budget\"",
    "\"budget tracker\" agent",
    "\"time budget\" agentic reasoning",
    "\"test-time scaling\" agentic tool use",
    "\"cost-uncertainty tradeoff\" agent",
    "budget-constrained \"LLM agent\"",

    # Self-awareness and metacognition
    "\"behavioral self-awareness\" LLM",
    "LLM \"aware of their\" behaviors",
    "\"self-aware agent\" tool use",
    "\"metacognitive learning\" LLM agent",
    "\"metacognition\" large language model agent",
    "LLM \"predict their own failures\"",
    "\"intrinsic metacognitive\" self-improving agent",

    # Confidence estimation and calibration
    "\"confidence calibration\" \"LLM agent\"",
    "\"confidence estimation\" multi-turn LLM",
    "\"agentic confidence calibration\"",
    "\"miscalibration\" tool-use agent",
    "\"confidence dichotomy\" tool-use agent",
    "\"verbalized confidence\" LLM agent",
    "\"calibrated uncertainty\" language model",
    "model-internal confidence estimation agent",

    # Uncertainty quantification
    "\"uncertainty quantification\" \"LLM agent\"",
    "\"uncertainty quantification\" tool calling",
    "\"uncertainty quantification\" function calling",
    "\"uncertainty-aware\" tool-use agent",
    "\"uncertainty-aware\" clarification-seeking",
    "\"uncertainty-aware self-correction\" coding agent",

    # Tool-use necessity, overuse, and hallucination
    "\"tool overuse\" LLM",
    "\"tool-overuse illusion\"",
    "agent invoke tools \"epistemically necessary\"",
    "\"when (not) to call tools\"",
    "\"tool selection\" hallucination LLM",
    "\"tool-calling\" hallucination agent",
    "internal representations hallucination tool selection",
    "acting less reasoning more tool use",

    # Clarification-seeking and underspecification
    "\"clarification-seeking\" LLM agent",
    "\"underspecified\" instructions coding agent",
    "\"ask or assume\" agent uncertainty",
    "infeasibility resolution tool-calling agent",

    # Process reward models and step-level verification
    "\"process reward model\" tool-using agent",
    "\"process reward model\" \"LLM agent\"",
    "step-level process quality tool-using agent",
    "tool-call reward model LLM",
    "\"process-level\" verification agent trajectory",

    # Agent reliability, robustness, and safety
    "\"science of AI agent reliability\"",
    "\"LLM agent\" robustness noisy environment",
    "safeguarding mutating steps LLM agent",
    "\"agent trajectory\" failure detection",
    "LLM agent consistency robustness predictability safety",

    # Multi-turn dynamics
    "LLMs \"lost in\" multi-turn conversation",
    "confidence estimation multi-turn interactions LLM",
    "persuasion robustness multi-turn LLM",

    # Tool-use / function-calling benchmarks
    "dual-control benchmark conversational agent tools",
    "long-horizon tool-use benchmark language agent",
    "\"function calling\" benchmark LLM agent",
    "MCP benchmark tool-using LLM agent",
    "multi-step constrained function calling benchmark",
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
