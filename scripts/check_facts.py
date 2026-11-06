"""Hold every published figure to the evidence.

    python scripts/check_facts.py

The README and the documents obey the rule the language model obeys: a figure that
cannot be traced to the evidence is refused. The evidence is the replay's scores, the
split measurement, the settings and the records, and the short list below of counts that
describe the project itself.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from warehouse_planner.data import Warehouse  # noqa: E402
from warehouse_planner.guard import ungrounded  # noqa: E402
from warehouse_planner.site import records_card, settings_card  # noqa: E402

DOCUMENTS = [ROOT / "README.md", ROOT / "data" / "README.md", *sorted((ROOT / "docs").glob("*.md"))]

# Counts that describe the project, each stated where it is used.
PROJECT = {
    "the loop, the tools and the methods": [5, 8, 3, 15, 20, 10],
    "thresholds in settings.py and demand.py": [25, 80, 95, 3, 5, 10, 90],
    "a location holds 18 boxes": [18],
    "sizes as the records write them": [105, 95, 10.5, 9.5, 215],
    "the dataset's year and the paper": [2023, 2025],
    "Python versions in CI": [3.10, 3.11, 3.12],
}

# Code, commands, links and badges are about the project, not its results.
_SKIP_LINE = re.compile(r"^\s*(?:```|\[!\[|<|\|---)")
_INLINE = re.compile(r"`[^`]*`|\]\([^)]*\)")
_MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"
_DATE = re.compile(
    rf"\b\d{{1,2}} (?:{_MONTHS})(?: \d{{4}})?|\b(?:{_MONTHS}) \d{{4}}|\b\d{{4}}-\d{{2}}-\d{{2}}\b"
)


def evidence() -> list:
    folder = ROOT / "docs" / "evidence"
    replay = json.loads((folder / "replay.json").read_text(encoding="utf-8"))
    split = json.loads((folder / "split.json").read_text(encoding="utf-8"))
    warehouse = Warehouse.load()
    return [replay, split, settings_card(warehouse), records_card(warehouse), PROJECT]


def prose(path: Path) -> str:
    kept = []
    fenced = False
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("```"):
            fenced = not fenced
            continue
        if fenced or _SKIP_LINE.match(line):
            continue
        kept.append(_DATE.sub(" ", _INLINE.sub(" ", line)))
    return "\n".join(kept)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    known = evidence()
    failed = 0
    for path in DOCUMENTS:
        text = prose(path)
        missing = ungrounded(text, known, ignore_below=3.0)
        name = path.relative_to(ROOT).as_posix()
        if missing:
            failed += 1
            print(f"{name}: no source for {sorted(set(missing))}")
        else:
            print(f"{name}: every figure traced")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
