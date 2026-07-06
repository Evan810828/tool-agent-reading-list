#!/usr/bin/env python3
"""Filter and assign deterministic topic tags to candidate paper JSON files."""

import argparse
import json
import pathlib
import re
from typing import List, Tuple


ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_FILES = [
    ROOT / "data" / "candidates_latest.json",
    ROOT / "data" / "candidates_citations.json",
]

TAG_RULES = [
    ("budget and cost", ("budget", "cost-aware", "cost aware", "tool-call budget", "time budget")),
    ("self-awareness", ("self-aware", "self awareness", "aware of their", "metacognitive", "metacognition")),
    ("confidence calibration", ("confidence", "calibration", "calibrated", "miscalibration", "verbalized confidence")),
    ("uncertainty", ("uncertainty", "uncertain", "selective prediction")),
    ("tool use", ("tool use", "tool-use", "tool using", "tool-using", "tool calling", "tool-calling", "function calling")),
    ("tool selection", ("tool selection", "call tools", "invoke tools", "when not to call tools", "tool overuse", "tool-overuse")),
    ("hallucination", ("hallucination", "hallucinate", "hallucinated")),
    ("clarification", ("clarification", "clarification-seeking", "ask or assume", "underspecified", "infeasibility")),
    ("process reward model", ("process reward", "prm", "process-level", "process level", "step-level", "step level")),
    ("verification", ("verification", "verifier", "verify", "verified", "trajectory verification")),
    ("failure detection", ("failure detection", "predict their own failures", "failure mode", "failure analysis")),
    ("monitoring", ("monitoring", "monitor", "runtime monitor")),
    ("reliability", ("reliability", "reliable", "consistency", "predictability")),
    ("robustness and safety", ("robustness", "robust", "safety", "safeguarding", "noisy environment")),
    ("multi-turn", ("multi-turn", "long-horizon", "conversation", "conversational", "persuasion")),
    ("benchmark", ("benchmark", "evaluation", "evaluate", "agentbench", "webarena")),
    ("coding agent", ("coding agent", "program repair", "software engineering", "code generation")),
    ("web agent", ("web agent", "browser", "web navigation", "webarena")),
    ("security", ("security", "vulnerab", "attack", "jailbreak", "safeguard")),
    ("agent trajectory", ("trajectory", "trajectories", "trace", "rollout")),
    ("tool agent", ("llm agent", "ai agent", "agentic", "language agent", "agent skills")),
]


def normalize(value):
    text = str(value or "").lower()
    text = re.sub(r"[\W_]+", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def discovery_text(item):
    parts = []
    for discovery in item.get("discoveredBy") or []:
        if isinstance(discovery, dict):
            parts.append(discovery.get("query"))
            parts.append(discovery.get("source"))
    return " ".join(str(part or "") for part in parts)


def text_for_item(item):
    fields = [
        item.get("title"),
        item.get("abstract"),
        item.get("venue"),
        item.get("tldr"),
        discovery_text(item),
    ]
    return normalize(" ".join(str(field or "") for field in fields))


def auto_tags(item, max_tags):
    text = text_for_item(item)
    existing = [tag for tag in item.get("tags") or [] if tag]
    tags = list(dict.fromkeys(existing))

    for tag, needles in TAG_RULES:
        if tag in tags:
            continue
        if any(normalize(needle) in text for needle in needles):
            tags.append(tag)
        if len(tags) >= max_tags:
            break

    if not tags:
        tags.append("tool agent")
    return tags[:max_tags]


def paper_year(item):
    year = item.get("year")
    if isinstance(year, int):
        return year
    if isinstance(year, str) and year.isdigit():
        return int(year)
    return None


def keep_item(item, min_year):
    year = paper_year(item)
    return year is not None and year >= min_year


def tag_file(path: pathlib.Path, max_tags: int, min_year: int) -> Tuple[int, int, int]:
    if not path.exists():
        return 0, 0, 0
    items = json.loads(path.read_text(encoding="utf-8"))
    before_total = len(items)
    items = [item for item in items if keep_item(item, min_year)]
    changed = 0
    for item in items:
        before = item.get("tags") or []
        after = auto_tags(item, max_tags)
        if after != before:
            item["tags"] = after
            changed += 1
    path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return before_total, len(items), changed


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="*", type=pathlib.Path, default=DEFAULT_FILES)
    parser.add_argument("--max-tags", type=int, default=5)
    parser.add_argument("--min-year", type=int, default=2023)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    for path in args.files:
        total, kept, changed = tag_file(path, args.max_tags, args.min_year)
        print(f"{path}: kept {kept} of {total} records from {args.min_year}+; tagged {changed}")


if __name__ == "__main__":
    main()
