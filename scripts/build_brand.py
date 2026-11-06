"""Generate the site icons and the social preview from one mark: boxes coming down a rack.

    python scripts/build_brand.py

Writes favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png and
site.webmanifest into site/, then renders docs/brand/social-preview.html to
social-preview.png with Chrome when Chrome is installed.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
BRAND = ROOT / "docs" / "brand"

GROUND = (31, 95, 191)  # #1f5fbf, the site's accent
INK = (255, 255, 255)
FADED = (143, 175, 223)  # white at half strength on the ground: the slot the box goes to

# Designed on a 64 by 64 grid, so the raster and the vector use the same numbers.
GRID = 64
CORNER = 14
POSTS = [(11, 9, 15, 55), (49, 9, 53, 55)]
SHELVES = [(11, 26, 53, 29), (11, 51, 53, 55)]
BOXES = [(18, 15, 30, 26), (33, 15, 45, 26)]
SLOT = (18, 40, 30, 51)
ARROW = [(39, 33), (39, 46)]
HEAD = [(34, 41), (39, 46.5), (44, 41)]
STROKE = 4


def draw_mark(size: int) -> Image.Image:
    scale = 8
    canvas = GRID * scale
    image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle([(0, 0), (canvas - 1, canvas - 1)], radius=CORNER * scale, fill=GROUND)

    def box(rect: tuple[float, float, float, float], fill: tuple[int, int, int], r: float) -> None:
        x0, y0, x1, y1 = (v * scale for v in rect)
        draw.rounded_rectangle([(x0, y0), (x1, y1)], radius=r * scale, fill=fill)

    for rect in POSTS + SHELVES:
        box(rect, INK, 1)
    for rect in BOXES:
        box(rect, INK, 2)
    box(SLOT, FADED, 2)
    width = STROKE * scale
    line = [(x * scale, y * scale) for x, y in ARROW]
    head = [(x * scale, y * scale) for x, y in HEAD]
    draw.line(line, fill=INK, width=width)
    draw.line(head, fill=INK, width=width, joint="curve")
    radius = width // 2
    for x, y in [line[0], head[0], head[2]]:
        draw.ellipse([(x - radius, y - radius), (x + radius, y + radius)], fill=INK)
    return image.resize((size, size), Image.LANCZOS)


def svg() -> str:
    def rect(r: tuple[float, float, float, float], fill: str, rx: float) -> str:
        x0, y0, x1, y1 = r
        size = f'width="{x1 - x0}" height="{y1 - y0}"'
        return f'<rect x="{x0}" y="{y0}" {size} rx="{rx}" fill="{fill}"/>'

    parts = [rect(r, "#fff", 1) for r in POSTS + SHELVES]
    parts += [rect(r, "#fff", 2) for r in BOXES]
    parts.append(rect(SLOT, "#8fafdf", 2))
    (x0, y0), (_, y1) = ARROW
    head = " ".join(f"{x},{y}" for x, y in HEAD)
    parts.append(
        f'<path d="M{x0} {y0}V{y1}" stroke="#fff" stroke-width="{STROKE}" stroke-linecap="round"/>'
        f'<polyline points="{head}" fill="none" stroke="#fff" stroke-width="{STROKE}" '
        'stroke-linecap="round" stroke-linejoin="round"/>'
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {GRID} {GRID}">'
        f'<rect width="{GRID}" height="{GRID}" rx="{CORNER}" fill="#1f5fbf"/>'
        f"{''.join(parts)}</svg>\n"
    )


def chrome() -> str | None:
    for candidate in (
        os.environ.get("CHROME_PATH", ""),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
    ):
        if candidate and Path(candidate).exists():
            return candidate
    return shutil.which("google-chrome") or shutil.which("chromium")


def render(source: Path, out: Path, width: int, height: int) -> bool:
    exe = chrome()
    if exe is None:
        print(f"  Chrome not found: {out.name} left as it was")
        return False
    with tempfile.TemporaryDirectory() as profile:
        subprocess.run(
            [
                exe,
                "--headless=new",
                "--disable-gpu",
                "--hide-scrollbars",
                f"--user-data-dir={profile}",
                f"--window-size={width},{height}",
                "--force-device-scale-factor=1",
                f"--screenshot={out}",
                source.as_uri(),
            ],
            check=True,
            capture_output=True,
            timeout=120,
        )
    return out.exists()


def main() -> None:
    (SITE / "favicon.svg").write_text(svg(), encoding="utf-8")
    shutil.copyfile(SITE / "favicon.svg", BRAND / "mark.svg")
    draw_mark(256).save(SITE / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    draw_mark(180).save(SITE / "apple-touch-icon.png")
    draw_mark(192).save(SITE / "icon-192.png")
    draw_mark(512).save(SITE / "icon-512.png")
    manifest = {
        "name": "Warehouse Planning Agent",
        "short_name": "Planning Agent",
        "start_url": "./",
        "display": "standalone",
        "background_color": "#f6f7f9",
        "theme_color": "#1f5fbf",
        "icons": [
            {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
        ],
    }
    (SITE / "site.webmanifest").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    if render(BRAND / "social-preview.html", BRAND / "social-preview.png", 1280, 640):
        shutil.copyfile(BRAND / "social-preview.png", SITE / "social-preview.png")
    print("icons and social preview written")


if __name__ == "__main__":
    main()
