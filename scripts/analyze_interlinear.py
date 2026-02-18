#!/usr/bin/env python3
"""Analyze interlinear data from a large JSON report.

This script does not read any input unless an explicit --input is provided.
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze interlinear report JSON.")
    parser.add_argument(
        "--input",
        required=True,
        help="Path to the large JSON report file.",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Path to write analysis summary JSON.",
    )
    return parser.parse_args()


def _coerce_project_list(data: Any) -> List[Dict[str, Any]]:
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        if "projects" in data and isinstance(data["projects"], list):
            return [item for item in data["projects"] if isinstance(item, dict)]
    return []


def _get_usage_list(item: Dict[str, Any]) -> List[Dict[str, Any]]:
    interlinear = item.get("interlinear") if isinstance(item.get("interlinear"), dict) else {}
    usage_list = interlinear.get("usageList")
    if not isinstance(usage_list, list):
        usage_list = item.get("interlinear.usageList")
    if not isinstance(usage_list, list):
        return []
    return [entry for entry in usage_list if isinstance(entry, dict)]


def _get_interlinear_count(item: Dict[str, Any], usage_list: List[Dict[str, Any]]) -> Optional[int]:
    interlinear = item.get("interlinear") if isinstance(item.get("interlinear"), dict) else {}
    number = interlinear.get("number")
    if not isinstance(number, int):
        number = item.get("interlinear.number")
    if isinstance(number, int):
        return number
    if usage_list:
        return len(usage_list)
    return None


def _iter_usage_books(usage_list: Iterable[Dict[str, Any]]) -> Iterable[str]:
    for entry in usage_list:
        book = entry.get("book")
        if isinstance(book, str) and book:
            yield book


def _get_setup_books(item: Dict[str, Any]) -> List[str]:
    setup_list = item.get("interlinear.interlinearSetupList")
    if not isinstance(setup_list, list):
        return []
    books = set()
    for entry in setup_list:
        if not isinstance(entry, dict):
            continue
        books_with_content = entry.get("booksWithContent")
        if not isinstance(books_with_content, list):
            continue
        for book in books_with_content:
            if isinstance(book, str) and book:
                books.add(book)
    return sorted(books)


def _has_recent_activity(usage_list: Iterable[Dict[str, Any]], cutoff_epoch: float) -> bool:
    for entry in usage_list:
        date_value = entry.get("date")
        if isinstance(date_value, (int, float)) and date_value >= cutoff_epoch:
            return True
    return False


def _summarize_typical(values: List[int]) -> Dict[str, Any]:
    if not values:
        return {"count": 0, "mean": None, "median": None, "mode": None}
    mean_val = statistics.fmean(values)
    median_val = statistics.median(values)
    modes = statistics.multimode(values)
    mode_val = modes[0] if modes else None
    return {
        "count": len(values),
        "mean": mean_val,
        "median": median_val,
        "mode": mode_val,
    }


def summarize_report(data: Any) -> Dict[str, Any]:
    """Summarize interlinear usage across projects."""
    projects = _coerce_project_list(data)
    usage_counts: List[int] = []
    book_counts: Dict[str, int] = {}
    interlinear_number_projects: Dict[int, int] = {}
    interlinear_number_with_setup: Dict[int, int] = {}
    interlinear_number_without_setup: Dict[int, int] = {}
    projects_per_lang: Dict[str, int] = {}
    unique_langs_per_project: List[int] = []

    now_epoch = time.time()
    recent_project_windows = {1: 0, 2: 0, 6: 0}
    recent_book_windows = {1: 0, 2: 0, 6: 0}

    for item in projects:
        usage_list = _get_usage_list(item)
        interlinear_count = _get_interlinear_count(item, usage_list)
        if isinstance(interlinear_count, int):
            usage_counts.append(interlinear_count)
            interlinear_number_projects[interlinear_count] = (
                interlinear_number_projects.get(interlinear_count, 0) + 1
            )

        setup_books = _get_setup_books(item)
        has_setup_list = bool(setup_books)
        if isinstance(interlinear_count, int):
            if has_setup_list:
                interlinear_number_with_setup[interlinear_count] = (
                    interlinear_number_with_setup.get(interlinear_count, 0) + 1
                )
            else:
                interlinear_number_without_setup[interlinear_count] = (
                    interlinear_number_without_setup.get(interlinear_count, 0) + 1
                )
        if setup_books:
            for book in setup_books:
                book_counts[book] = book_counts.get(book, 0) + 1
        else:
            for book in _iter_usage_books(usage_list):
                book_counts[book] = book_counts.get(book, 0) + 1

        project_langs = set()
        for entry in usage_list:
            lang = entry.get("lang")
            if isinstance(lang, str) and lang:
                project_langs.add(lang)
        if project_langs:
            unique_langs_per_project.append(len(project_langs))
            for lang in project_langs:
                projects_per_lang[lang] = projects_per_lang.get(lang, 0) + 1

        for months in recent_project_windows.keys():
            cutoff = now_epoch - (months * 30 * 24 * 60 * 60)
            if _has_recent_activity(usage_list, cutoff):
                recent_project_windows[months] += 1
                recent_books_for_project = set()
                if setup_books:
                    recent_books_for_project.update(setup_books)
                else:
                    for entry in usage_list:
                        date_value = entry.get("date")
                        book = entry.get("book")
                        if (
                            isinstance(date_value, (int, float))
                            and date_value >= cutoff
                            and isinstance(book, str)
                            and book
                        ):
                            recent_books_for_project.add(book)
                recent_book_windows[months] += len(recent_books_for_project)

    most_frequent_book: Optional[Tuple[str, int]] = None
    if book_counts:
        most_frequent_book = max(book_counts.items(), key=lambda item: item[1])

    summary: Dict[str, Any] = {
        "project_count": len(projects),
        "interlinear_texts_per_project": _summarize_typical(usage_counts),
        "projects_per_interlinear_number": {
            "total": dict(sorted(interlinear_number_projects.items(), key=lambda item: item[0])),
            "with_setup_list": dict(
                sorted(interlinear_number_with_setup.items(), key=lambda item: item[0])
            ),
            "without_setup_list": dict(
                sorted(interlinear_number_without_setup.items(), key=lambda item: item[0])
            ),
        },
        "languages_per_project": _summarize_typical(unique_langs_per_project),
        "projects_per_lang": dict(
            sorted(projects_per_lang.items(), key=lambda item: item[1], reverse=True)
        ),
        "most_frequent_book": {
            "book": most_frequent_book[0],
            "count": most_frequent_book[1],
        }
        if most_frequent_book
        else None,
        "recent_activity_windows": {
            "projects": {str(k): v for k, v in recent_project_windows.items()},
            "books": {str(k): v for k, v in recent_book_windows.items()},
        },
        "book_counts": dict(sorted(book_counts.items(), key=lambda item: item[1], reverse=True)),
    }
    return summary


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # Read only when explicitly requested.
    with input_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    summary = summarize_report(data)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"Wrote summary to: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
