#!/usr/bin/env python3
"""Describe analysis outputs for quick inspection."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Describe analysis result JSON.")
    parser.add_argument("--input", required=True, help="Path to analysis result JSON.")
    return parser.parse_args()


def pretty_print(data: Any) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2))


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    with input_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    pretty_print(data)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
