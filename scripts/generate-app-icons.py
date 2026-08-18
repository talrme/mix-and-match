#!/usr/bin/env python3
"""Generate home-screen and browser icons from the jester hat outfit."""

from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "outfits" / "009.png"
OUTPUT_DIR = ROOT / "assets" / "icons"
ICON_SIZES = {
    "favicon-32.png": 32,
    "apple-touch-icon.png": 180,
    "app-icon-192.png": 192,
    "app-icon-512.png": 512,
}


def mix(a: int, b: int, amount: float) -> int:
    return round(a + (b - a) * amount)


def make_icon(source: Image.Image, size: int) -> Image.Image:
    top = (255, 214, 232)
    bottom = (255, 245, 214)
    canvas = Image.new("RGBA", (size, size))

    for y in range(size):
        amount = y / max(1, size - 1)
        color = tuple(mix(top[i], bottom[i], amount) for i in range(3)) + (255,)
        canvas.paste(color, (0, y, size, y + 1))

    hat = source.copy()
    alpha_bounds = hat.getchannel("A").getbbox()
    if alpha_bounds:
        hat = hat.crop(alpha_bounds)

    max_width = round(size * 0.78)
    max_height = round(size * 0.58)
    scale = min(max_width / hat.width, max_height / hat.height)
    hat = hat.resize(
        (max(1, round(hat.width * scale)), max(1, round(hat.height * scale))),
        Image.Resampling.LANCZOS,
    )

    x = (size - hat.width) // 2
    y = (size - hat.height) // 2

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_alpha = hat.getchannel("A").point(lambda value: round(value * 0.22))
    shadow_piece = Image.new("RGBA", hat.size, (66, 35, 82, 0))
    shadow_piece.putalpha(shadow_alpha)
    shadow.alpha_composite(shadow_piece, (x, y + max(1, round(size * 0.018))))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(0.6, size * 0.012)))

    canvas = Image.alpha_composite(canvas, shadow)
    canvas.alpha_composite(hat, (x, y))
    return canvas.convert("RGB")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    for filename, size in ICON_SIZES.items():
        make_icon(source, size).save(OUTPUT_DIR / filename, format="PNG", optimize=True)


if __name__ == "__main__":
    main()
