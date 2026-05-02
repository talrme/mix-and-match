# Miri’s Mix & Match

**Live:** [https://talrme.github.io/mix-and-match](https://talrme.github.io/mix-and-match)

A browser-based sticker scene builder: drag stickers and backgrounds, doodle on the canvas, add text, undo layers, and share a link that restores your scene.

Live development is plain static HTML/CSS/JS—no build step.

## Run locally

Because the app loads `assets/manifest.json` with `fetch`, open it through a local server (not `file://`):

```bash
cd miris-mix-and-match
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080).

## Assets & manifest

Sticker and background tabs discover images **in numeric order** under each folder listed in [`assets/manifest.json`](assets/manifest.json):

| Section      | Folder               |
|-------------|----------------------|
| People      | `assets/people/`     |
| Outfits     | `assets/outfits/`    |
| Extras      | `assets/extras/`     |
| Backgrounds | `assets/backgrounds/` |

Use zero-padded names: `001.png`, `002.png`, … (width set by `numberPadding`, default `3`). Discovery stops after **`stopAfterMisses`** consecutive missing files (default `10`).

Optional per-section fields for special cases:

- **`filenameTemplate`** — e.g. `"{n}.png"` (default)
- **`alternateFilenameTemplates`** — extra patterns tried when the primary URL fails

## Demo PNG generator

Bundled placeholder art can be regenerated (requires [Pillow](https://pypi.org/project/pillow/)):

```bash
pip3 install pillow
python3 scripts/generate-demo-assets.py
```

Adjust resolution via the `SCALE` constant at the top of that script.

## Repo

[github.com/talrme/mix-and-match](https://github.com/talrme/mix-and-match)
