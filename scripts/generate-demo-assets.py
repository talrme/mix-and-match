#!/usr/bin/env python3
"""One-off generator for bundled demo PNGs (matches former BUILTIN stickers).

Renders at high pixel dimensions so assets stay sharp on retina / large canvases.
"""
from __future__ import annotations

import math
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRS = {
    "people": os.path.join(ROOT, "assets", "people"),
    "outfits": os.path.join(ROOT, "assets", "outfits"),
    "extras": os.path.join(ROOT, "assets", "extras"),
    "backgrounds": os.path.join(ROOT, "assets", "backgrounds"),
}

# Legacy art was 100×100 stickers / 200×120 backgrounds — multiply for export size.
SCALE = 8
STICKER = 100 * SCALE
BG_W, BG_H = 200 * SCALE, 120 * SCALE
RAINBOW_W, RAINBOW_H = 120 * SCALE, 80 * SCALE


def z(x: float) -> int:
    return int(round(x))


def lw(w: float) -> int:
    return max(1, z(w * SCALE))


def save(im: Image.Image, folder: str, name: str) -> None:
    path = os.path.join(DIRS[folder], name)
    im.save(path, "PNG", compress_level=6)
    print("wrote", path, "(%s×%s)" % im.size)


def draw_smile() -> Image.Image:
    s = SCALE
    im = Image.new("RGBA", (STICKER, STICKER), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse(
        (z(8 * s), z(8 * s), z(92 * s), z(92 * s)),
        fill="#ffe066",
        outline="#f39c12",
        width=lw(4),
    )
    d.ellipse((z(30 * s), z(34 * s), z(42 * s), z(46 * s)), fill="#2d3436")
    d.ellipse((z(58 * s), z(34 * s), z(70 * s), z(46 * s)), fill="#2d3436")
    d.arc(
        (z(28 * s), z(52 * s), z(72 * s), z(78 * s)),
        start=0,
        end=180,
        fill="#2d3436",
        width=lw(5),
    )
    return im


def heart_points(cx: float, cy: float, heart_scale: float) -> list[tuple[float, float]]:
    pts = []
    for t in range(0, 361, 3):
        rad = math.radians(t)
        x = heart_scale * 16 * math.sin(rad) ** 3
        y = -heart_scale * (
            13 * math.cos(rad)
            - 5 * math.cos(2 * rad)
            - 2 * math.cos(3 * rad)
            - math.cos(4 * rad)
        )
        pts.append((cx + x, cy + y))
    return pts


def draw_heart() -> Image.Image:
    s = SCALE
    im = Image.new("RGBA", (STICKER, STICKER), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pts = [(z(px), z(py)) for px, py in heart_points(50 * s, 42 * s, 1.35 * s)]
    d.polygon(pts, fill="#ff6b9d", outline="#c0392b", width=lw(3))
    return im


def draw_star() -> Image.Image:
    s = SCALE
    im = Image.new("RGBA", (STICKER, STICKER), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy, r_out, r_in, n = 50 * s, 50 * s, 38 * s, 16 * s, 5
    pts = []
    for i in range(n * 2):
        a = math.pi / 2 + i * math.pi / n
        r = r_out if i % 2 == 0 else r_in
        pts.append((cx + r * math.cos(a), cy - r * math.sin(a)))
    pts_i = [(z(px), z(py)) for px, py in pts]
    d.polygon(pts_i, fill="#ffd93d", outline="#f39c12", width=lw(4))
    return im


def draw_ball() -> Image.Image:
    s = SCALE
    im = Image.new("RGBA", (STICKER, STICKER), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse(
        (z(10 * s), z(10 * s), z(90 * s), z(90 * s)),
        fill="#7c5cff",
        outline="#4834a4",
        width=lw(4),
    )
    hl = Image.new("RGBA", (STICKER, STICKER), (0, 0, 0, 0))
    h = ImageDraw.Draw(hl)
    h.ellipse(
        (z(26 * s), z(26 * s), z(50 * s), z(50 * s)),
        fill=(255, 255, 255, 90),
    )
    im = Image.alpha_composite(im, hl)
    return im


def draw_flower() -> Image.Image:
    s = SCALE
    im = Image.new("RGBA", (STICKER, STICKER), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for angle in (0, 90, 180, 270):
        rad = math.radians(angle)
        ox, oy = 50 * s + 28 * s * math.cos(rad), 50 * s - 28 * s * math.sin(rad)
        r = 14 * s
        d.ellipse(
            (z(ox - r), z(oy - r), z(ox + r), z(oy + r)),
            fill="#ff6b9d",
            outline="#c0392b",
            width=lw(2),
        )
    d.ellipse(
        (z(38 * s), z(38 * s), z(62 * s), z(62 * s)),
        fill="#ffe066",
        outline="#f39c12",
        width=lw(2),
    )
    return im


def draw_rainbow() -> Image.Image:
    s = SCALE
    im = Image.new("RGBA", (RAINBOW_W, RAINBOW_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    colors = ["#ff6b9d", "#ffd93d", "#6bcf7f", "#4dabf7"]
    w = 10 * s
    for i, c in enumerate(colors):
        y0 = 62 * s - i * w
        d.arc(
            (
                z(10 * s - i * 4 * s),
                z(y0 - 50 * s),
                z(110 * s + i * 4 * s),
                z(y0 + 50 * s),
            ),
            start=0,
            end=180,
            fill=c,
            width=max(1, z(w)),
        )
    return im


def draw_grass() -> Image.Image:
    s = SCALE
    im = Image.new("RGBA", (BG_W, BG_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, BG_W, BG_H), fill="#87ceeb")
    d.rectangle((0, z(70 * s), BG_W, BG_H), fill="#6bcf7f")
    d.ellipse((z(138 * s), z(13 * s), z(182 * s), z(57 * s)), fill="#ffffff")
    d.ellipse((z(157 * s), z(22 * s), z(193 * s), z(58 * s)), fill="#ffffff")
    return im


def draw_night() -> Image.Image:
    s = SCALE
    im = Image.new("RGBA", (BG_W, BG_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, BG_W, BG_H), fill="#2d1b69")
    d.ellipse(
        (z(132 * s), z(17 * s), z(168 * s), z(53 * s)),
        fill="#ffe066",
        outline="#f39c12",
        width=lw(2),
    )
    for x, y, r in ((40 * s, 25 * s, 2 * s), (70 * s, 18 * s, 1.5 * s), (90 * s, 40 * s, 1 * s)):
        d.ellipse((z(x - r), z(y - r), z(x + r), z(y + r)), fill="#ffffff")
    return im


def main() -> None:
    for p in DIRS.values():
        os.makedirs(p, exist_ok=True)

    save(draw_smile(), "people", "001.png")
    save(draw_heart(), "people", "002.png")
    save(draw_star(), "outfits", "001.png")
    save(draw_ball(), "outfits", "002.png")
    save(draw_flower(), "extras", "001.png")
    save(draw_rainbow(), "extras", "002.png")
    save(draw_grass(), "backgrounds", "001.png")
    save(draw_night(), "backgrounds", "002.png")


if __name__ == "__main__":
    main()
