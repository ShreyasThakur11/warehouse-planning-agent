"""Check the prose in this repository against the house style.

Three rules, applied to every text file the project wrote:

    1. No em dashes or en dashes used as punctuation.
    2. No emoji or decorative symbols.
    3. No filler vocabulary: words that can be deleted without losing meaning.

Exits non-zero on any finding, so it can sit in CI.
"""

from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SKIP = {".git", ".venv", "__pycache__", ".pytest_cache", ".ruff_cache", ".mypy_cache", "_site"}
SKIP.add("node_modules")
SUFFIXES = {".py", ".md", ".yaml", ".yml", ".txt", ".html", ".css", ".js", ".mjs", ".toml"}

FILLER = [
    "comprehensive",
    "crucial",
    "crucially",
    "delve",
    "elevate",
    "empower",
    "encompass",
    "encompasses",
    "furthermore",
    "game changer",
    "game-changing",
    "cutting-edge",
    "importantly",
    "leverage",
    "meticulous",
    "moreover",
    "myriad",
    "needless to say",
    "notably",
    "paramount",
    "pivotal",
    "plethora",
    "profound",
    "realm",
    "robust",
    "seamless",
    "seamlessly",
    "serves as",
    "showcase",
    "state-of-the-art",
    "tapestry",
    "testament",
    "underscore",
    "underscores",
    "utilize",
    "valuable resource",
]
DASHES = {"—": "em dash", "–": "en dash", "―": "horizontal bar"}
EMOJI = [
    (0x1F000, 0x1FAFF),
    (0x2600, 0x27BF),
    (0x2B00, 0x2BFF),
    (0xFE00, 0xFE0F),
]


def is_emoji(char: str) -> bool:
    code = ord(char)
    return any(low <= code <= high for low, high in EMOJI)


def files() -> list[Path]:
    this = Path(__file__).resolve()
    found = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SUFFIXES or path.resolve() == this:
            continue
        if any(part in SKIP for part in path.relative_to(ROOT).parts):
            continue
        found.append(path)
    return sorted(found)


def check(path: Path) -> list[tuple[int, str, str]]:
    findings: list[tuple[int, str, str]] = []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError:
        return findings
    for number, line in enumerate(lines, start=1):
        for char, name in DASHES.items():
            if char in line:
                findings.append((number, name, line.strip()[:90]))
        for char in line:
            if is_emoji(char):
                label = unicodedata.name(char, f"U+{ord(char):04X}")
                findings.append((number, f"emoji ({label})", line.strip()[:90]))
                break
        lowered = line.lower()
        for phrase in FILLER:
            if re.search(r"\b" + re.escape(phrase) + r"\b", lowered):
                findings.append((number, f"filler ({phrase})", line.strip()[:90]))
    return findings


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    total = 0
    scanned = files()
    for path in scanned:
        findings = check(path)
        if findings:
            print(f"\n{path.relative_to(ROOT).as_posix()}")
        for number, rule, excerpt in findings:
            print(f"  line {number:>4}  {rule}\n             {excerpt}")
            total += 1
    print(f"\nScanned {len(scanned)} files. {total} finding(s).")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
