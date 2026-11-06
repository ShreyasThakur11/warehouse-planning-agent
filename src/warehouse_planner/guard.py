"""Throw out any brief that states a number no tool produced.

A language model writing from memory can produce a plausible figure that is not
real. Every figure a brief may state came from a tool, so the tool results are
the complete list of numbers allowed.
"""

from __future__ import annotations

import re
from typing import Any

# A number standing on its own: not part of a SKU code such as 8N10W9, a location
# such as H-06-31, a level range such as 1-2, or a date.
_NUMBER = re.compile(r"(?<![\w.\-/])[-+]?\d[\d,]*(?:\.\d+)?(?![\w\-/]|\.\d)")


def _value(token: str) -> float | None:
    try:
        return float(token.replace(",", ""))
    except ValueError:
        return None


def numbers_in(payload: Any, found: set[float] | None = None) -> set[float]:
    """Every number in a tool result, including those written inside its text."""
    found = set() if found is None else found
    if isinstance(payload, bool) or payload is None:
        return found
    if isinstance(payload, (int, float)):
        found.add(round(float(payload), 4))
    elif isinstance(payload, str):
        for match in _NUMBER.finditer(payload):
            value = _value(match.group())
            if value is not None:
                found.add(round(value, 4))
    elif isinstance(payload, dict):
        for value in payload.values():
            numbers_in(value, found)
    elif isinstance(payload, (list, tuple)):
        for item in payload:
            numbers_in(item, found)
    return found


def ungrounded(text: str, evidence: Any, ignore_below: float = 0.0) -> list[float]:
    """Numbers in ``text`` that appear nowhere in ``evidence``.

    A figure may differ from a tool's by rounding, up to half a unit or 1%.
    """
    allowed = numbers_in(evidence)
    missing = []
    for match in _NUMBER.finditer(text):
        value = _value(match.group())
        if value is None or abs(value) < ignore_below:
            continue
        if not any(abs(value - a) <= max(0.5, 0.01 * abs(a)) for a in allowed):
            missing.append(value)
    return missing
