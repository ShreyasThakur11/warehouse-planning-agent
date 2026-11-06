"""Check that the dashboard just built scores exactly what the published evidence says.

    python scripts/check_replay.py [_site]

The README and the documents quote docs/evidence/replay.json. The dashboard replays the
records again when it is built. If the two ever disagree, this check fails, so the site
and the documents cannot drift apart.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    site = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "_site"
    built = json.loads((site / "data" / "index.json").read_text(encoding="utf-8"))["scores"]
    published = json.loads((ROOT / "docs" / "evidence" / "replay.json").read_text(encoding="utf-8"))
    if built == published:
        print(f"The dashboard's {built['days']} graded days match the published evidence.")
        return 0
    for key in published:
        if built.get(key) != published[key]:
            print(f"{key}: published {published[key]}, built {built.get(key)}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
