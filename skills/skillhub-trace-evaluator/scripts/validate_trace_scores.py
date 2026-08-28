#!/usr/bin/env python3
"""Validate TRACE evaluator report JSON for score/field compliance.

Usage:
  python scripts/validate_trace_scores.py report.json
  python scripts/validate_trace_scores.py -

Exit 0 = ok, 1 = invalid (errors on stderr).
Stdlib only.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

DIMENSIONS = (
    "trust",
    "reliability",
    "adaptability",
    "convention",
    "effectiveness",
)

ITEMS: dict[str, tuple[str, ...]] = {
    "trust": ("scan", "domestic"),
    "reliability": ("stability", "func", "errorHandling"),
    "adaptability": ("boundary", "trigger"),
    "convention": ("progressive", "structure", "docQuality", "antiPatternFaq"),
    "effectiveness": ("accuracy", "completeness", "usability", "creativity"),
}

# Accept camelCase (preferred) and snake_case aliases for text fields.
USER_REASON_KEYS = ("userReason", "user_reason")
USER_SUMMARY_KEYS = ("userSummary", "user_summary")


def _first_str(obj: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for k in keys:
        if k in obj:
            v = obj[k]
            if isinstance(v, str):
                return v
            return None
    return None


def _has_nonempty_str(obj: dict[str, Any], keys: tuple[str, ...]) -> bool:
    v = _first_str(obj, keys)
    return v is not None and v.strip() != ""


def _check_score(path: str, score: Any, errors: list[str]) -> None:
    if not isinstance(score, (int, float)) or isinstance(score, bool):
        errors.append(f"{path}: score must be a number, got {type(score).__name__}")
        return
    if not (0 < float(score) <= 5.0):
        errors.append(f"{path}: score must satisfy 0 < score <= 5.0, got {score}")


def _validate_scored_item(path: str, item: Any, errors: list[str]) -> None:
    if not isinstance(item, dict):
        errors.append(f"{path}: must be an object")
        return
    if item.get("status") == "skipped":
        errors.append(f"{path}: only trust.scan may use status=skipped")
        return
    if "score" not in item:
        errors.append(f"{path}: missing score")
    else:
        _check_score(path, item["score"], errors)
    if not _has_nonempty_str(item, ("reason",)):
        errors.append(f"{path}: missing non-empty reason")
    if not _has_nonempty_str(item, USER_REASON_KEYS):
        errors.append(f"{path}: missing non-empty userReason/user_reason")


def _validate_scan_item(path: str, item: Any, errors: list[str]) -> None:
    if not isinstance(item, dict):
        errors.append(f"{path}: must be an object")
        return
    status = item.get("status")
    if status == "skipped":
        if not _has_nonempty_str(item, ("reason",)):
            errors.append(f"{path}: skipped scan requires non-empty reason")
        if not _has_nonempty_str(item, USER_REASON_KEYS):
            errors.append(f"{path}: skipped scan requires non-empty userReason/user_reason")
        if "score" in item:
            _check_score(path, item["score"], errors)
        return
    # Not skipped: treat as normal scored item (platform-style).
    _validate_scored_item(path, item, errors)


def validate_report(data: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(data, dict):
        return ["root: must be a JSON object"]

    if "dimensions" not in data:
        errors.append("root: missing dimensions")
    if not _has_nonempty_str(data, ("summary",)):
        errors.append("root: missing non-empty summary")
    if not _has_nonempty_str(data, USER_SUMMARY_KEYS):
        errors.append("root: missing non-empty userSummary/user_summary")

    dims = data.get("dimensions")
    if dims is None:
        return errors
    if not isinstance(dims, dict):
        errors.append("dimensions: must be an object")
        return errors

    missing = [d for d in DIMENSIONS if d not in dims]
    if missing:
        errors.append(f"dimensions: missing keys: {', '.join(missing)}")
    extra = [k for k in dims if k not in DIMENSIONS]
    if extra:
        errors.append(f"dimensions: unknown keys: {', '.join(sorted(extra))}")

    for dim in DIMENSIONS:
        if dim not in dims:
            continue
        dpath = f"dimensions.{dim}"
        dobj = dims[dim]
        if not isinstance(dobj, dict):
            errors.append(f"{dpath}: must be an object")
            continue
        if not _has_nonempty_str(dobj, ("reason",)):
            errors.append(f"{dpath}: missing non-empty reason")
        if not _has_nonempty_str(dobj, USER_REASON_KEYS):
            errors.append(f"{dpath}: missing non-empty userReason/user_reason")

        items = dobj.get("items")
        if not isinstance(items, dict):
            errors.append(f"{dpath}.items: must be an object")
            continue

        expected = ITEMS[dim]
        miss_items = [i for i in expected if i not in items]
        if miss_items:
            errors.append(f"{dpath}.items: missing keys: {', '.join(miss_items)}")
        unk_items = [k for k in items if k not in expected]
        if unk_items:
            errors.append(f"{dpath}.items: unknown keys: {', '.join(sorted(unk_items))}")

        for name in expected:
            if name not in items:
                continue
            ipath = f"{dpath}.items.{name}"
            if dim == "trust" and name == "scan":
                _validate_scan_item(ipath, items[name], errors)
            else:
                _validate_scored_item(ipath, items[name], errors)

    return errors


def _load(path: str) -> Any:
    if path == "-":
        return json.load(sys.stdin)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate TRACE report JSON scores/fields")
    parser.add_argument("path", help="report JSON file, or - for stdin")
    args = parser.parse_args(argv)

    try:
        data = _load(args.path)
    except FileNotFoundError:
        print(f"error: file not found: {args.path}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as e:
        print(f"error: invalid JSON: {e}", file=sys.stderr)
        return 1
    except OSError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    errors = validate_report(data)
    if errors:
        print(f"INVALID ({len(errors)} issue(s)):", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
