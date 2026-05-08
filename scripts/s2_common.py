#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared Semantic Scholar helpers for reading-list discovery scripts."""

from __future__ import annotations

import datetime as _dt
import json
import os
import pathlib
import re
import time
from typing import Any, Iterable

import requests


BASE_URL = "https://api.semanticscholar.org/graph/v1"

PAPER_FIELDS = ",".join(
    [
        "paperId",
        "title",
        "abstract",
        "authors",
        "venue",
        "year",
        "publicationDate",
        "publicationTypes",
        "externalIds",
        "citationCount",
        "influentialCitationCount",
        "referenceCount",
        "url",
        "openAccessPdf",
        "fieldsOfStudy",
        "s2FieldsOfStudy",
        "tldr",
    ]
)

CITING_PAPER_FIELDS = ",".join(
    [
        "citingPaper.paperId",
        "citingPaper.title",
        "citingPaper.abstract",
        "citingPaper.authors",
        "citingPaper.venue",
        "citingPaper.year",
        "citingPaper.externalIds",
        "citingPaper.citationCount",
        "citingPaper.url",
    ]
)


def today() -> str:
    return _dt.date.today().isoformat()


def is_empty(value: Any) -> bool:
    return value is None or value == "" or value == [] or value == {}


def normalize_title(title: str | None) -> str:
    text = (title or "").lower()
    text = re.sub(r"[\W_]+", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def arxiv_abs_url(arxiv_id: str | None) -> str | None:
    if not arxiv_id:
        return None
    return f"https://arxiv.org/abs/{arxiv_id}"


def stable_key(paper: dict[str, Any]) -> str:
    external = paper.get("externalIds") or {}
    doi = external.get("DOI") or paper.get("doi")
    arxiv = external.get("ArXiv") or paper.get("arxivId")
    if paper.get("paperId"):
        return f"s2:{paper['paperId']}"
    if arxiv:
        return f"arxiv:{str(arxiv).lower()}"
    if doi:
        return f"doi:{str(doi).lower()}"
    return f"title-year:{normalize_title(paper.get('title'))}:{paper.get('year') or ''}"


class S2Client:
    def __init__(self, api_key: str | None = None, delay_seconds: float = 1.1, retries: int = 4):
        self.session = requests.Session()
        self.headers = {}
        api_key = api_key if api_key is not None else os.environ.get("S2_API_KEY")
        api_key = api_key.strip() if api_key else api_key
        if api_key:
            self.headers["x-api-key"] = api_key
        self.delay_seconds = delay_seconds
        self.retries = retries
        self._last_request = 0.0

    def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{BASE_URL}{path}"
        for attempt in range(self.retries + 1):
            self._pace()
            res = self.session.get(url, params=params or {}, headers=self.headers, timeout=45)
            if res.status_code == 429 or 500 <= res.status_code < 600:
                if attempt >= self.retries:
                    raise RuntimeError(f"S2 API request failed after retries: {res.status_code} {res.text[:500]}")
                retry_after = res.headers.get("Retry-After")
                wait = float(retry_after) if retry_after else min(30.0, 2.0 ** attempt)
                time.sleep(wait)
                continue
            if res.status_code == 403 and self.headers.get("x-api-key"):
                raise RuntimeError(
                    "S2 API request failed: 403 Forbidden. "
                    "S2_API_KEY is loaded, but Semantic Scholar rejected it; check that the key is correct and active."
                )
            if res.status_code >= 400:
                raise RuntimeError(f"S2 API request failed: {res.status_code} {res.text[:500]}")
            return res.json()
        raise RuntimeError("unreachable retry loop")

    def _pace(self) -> None:
        elapsed = time.monotonic() - self._last_request
        if elapsed < self.delay_seconds:
            time.sleep(self.delay_seconds - elapsed)
        self._last_request = time.monotonic()


def normalize_paper(
    paper: dict[str, Any],
    *,
    discovery: dict[str, Any] | None = None,
    seed_title: str | None = None,
    seed_paper_id: str | None = None,
) -> dict[str, Any]:
    external = paper.get("externalIds") or {}
    arxiv_id = external.get("ArXiv")
    doi = external.get("DOI")
    tldr = paper.get("tldr") or {}
    open_access_pdf = paper.get("openAccessPdf") or {}

    authors = []
    for author in paper.get("authors") or []:
        if isinstance(author, dict) and author.get("name"):
            authors.append(author["name"])
        elif isinstance(author, str):
            authors.append(author)

    item = {
        "paperId": paper.get("paperId"),
        "title": paper.get("title"),
        "authors": authors,
        "venue": paper.get("venue"),
        "year": paper.get("year"),
        "publicationDate": paper.get("publicationDate"),
        "publicationTypes": paper.get("publicationTypes") or [],
        "url": paper.get("url") or arxiv_abs_url(arxiv_id),
        "arxivId": arxiv_id,
        "doi": doi,
        "externalIds": external,
        "citationCount": paper.get("citationCount"),
        "influentialCitationCount": paper.get("influentialCitationCount"),
        "referenceCount": paper.get("referenceCount"),
        "abstract": paper.get("abstract"),
        "tldr": tldr.get("text") if isinstance(tldr, dict) else tldr,
        "openAccessPdf": open_access_pdf.get("url") if isinstance(open_access_pdf, dict) else open_access_pdf,
        "fieldsOfStudy": paper.get("fieldsOfStudy") or [],
        "s2FieldsOfStudy": paper.get("s2FieldsOfStudy") or [],
        "tags": [],
        "source": "semantic_scholar",
        "discoveredBy": [discovery] if discovery else [],
        "addedAt": today(),
        "updatedAt": today(),
    }
    if seed_title:
        item["seedMatched"] = seed_title
        item["seedMatchedList"] = [seed_title]
    if seed_paper_id:
        item["seedPaperId"] = seed_paper_id
    return {k: v for k, v in item.items() if not is_empty(v) or k in {"tags", "discoveredBy"}}


def merge_unique_dicts(items: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = set()
    out = []
    for item in items:
        key = json.dumps(item, sort_keys=True, ensure_ascii=False)
        if key not in seen:
            seen.add(key)
            out.append(item)
    return out


def merge_records(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    merged = dict(existing)

    preserve_if_existing = {"tags", "note", "notes", "status", "decision", "addedAt"}
    for key, value in incoming.items():
        if key in preserve_if_existing and not is_empty(existing.get(key)):
            continue
        if is_empty(value):
            continue
        if key == "discoveredBy":
            merged[key] = merge_unique_dicts([*(existing.get(key) or []), *value])
        elif key == "seedMatchedList":
            seeds = [*(existing.get(key) or []), *value]
            merged[key] = list(dict.fromkeys(seeds))
            merged["seedMatched"] = "; ".join(merged[key][:3])
        else:
            merged[key] = value

    if incoming.get("seedMatched") and incoming.get("seedMatched") != existing.get("seedMatched"):
        seeds = [*(merged.get("seedMatchedList") or [])]
        seeds.append(incoming["seedMatched"])
        merged["seedMatchedList"] = list(dict.fromkeys(seeds))
        merged["seedMatched"] = "; ".join(merged["seedMatchedList"][:3])

    merged["updatedAt"] = today()
    return merged


def sort_papers(papers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        papers,
        key=lambda p: (
            -(p.get("year") or 0),
            -(p.get("citationCount") or 0),
            normalize_title(p.get("title")),
        ),
    )


def merge_candidate_file(outfile: pathlib.Path, new_entries: list[dict[str, Any]]) -> tuple[str, list[dict[str, Any]]]:
    if outfile.exists():
        try:
            existing = json.loads(outfile.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = []
    else:
        existing = []

    records: dict[str, dict[str, Any]] = {}
    for paper in existing:
        records[stable_key(paper)] = paper

    added = []
    updated = 0
    for paper in new_entries:
        key = stable_key(paper)
        if key in records:
            before = records[key]
            after = merge_records(before, paper)
            if after != before:
                updated += 1
            records[key] = after
        else:
            records[key] = paper
            added.append(paper)

    merged = sort_papers(list(records.values()))
    outfile.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(merged)} items (+{len(added)} new, {updated} updated) -> {outfile}")
    return str(outfile), added
