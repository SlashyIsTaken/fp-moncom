# README asset capture

Regenerates the hero animation in the root `README.md` (`assets/moncom-wall.gif`
and `assets/moncom-wall.mp4`) from the live Three.js video-wall scene at
<https://flarepoint.nl/moncom>.

The scene uses a fixed camera and auto-cycles through 11 monitor layouts
(single display → side-by-side → 2×2 → 3×3 wall), holding ~2.6s each, so the
capture is fully passive — no interaction scripting needed.

## Requirements
- `ffmpeg` on PATH
- Playwright + Chromium, installed locally without touching `package.json`:
  ```bash
  npm install --no-save playwright
  npx playwright install chromium
  ```

## Steps
```bash
# 1. Record one full layout cycle to a webm (≈30s).
node tools/capture/capture.mjs

# 2. Encode. Crop is the canvas region within the 1600x1000 page; the wall
#    sits in a band with black headroom kept for the taller 2×2 / 3×3 layouts.
cd tools/capture
CROP="crop=656:600:161:220"

# Master MP4 — full cycle, crisp, ~1.3MB (best for a <video> embed).
ffmpeg -y -ss 1.2 -t 28.6 -i video/wall.webm -vf "$CROP" \
  -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart ../../assets/moncom-wall.mp4

# Hero GIF — 12.6s multi-monitor build (dual → quad → 3×3 wall), palette-optimized.
ffmpeg -y -ss 12 -t 12.6 -i video/wall.webm \
  -vf "$CROP,fps=12,scale=600:-1:flags=lanczos,palettegen=max_colors=128:stats_mode=diff" palette.png
ffmpeg -y -ss 12 -t 12.6 -i video/wall.webm -i palette.png \
  -lavfi "$CROP,fps=12,scale=600:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4" \
  ../../assets/moncom-wall.gif
```

## Tuning
- **Different layouts in the GIF:** change `-ss`/`-t` on the GIF commands. The
  full cycle (after the ~1.2s fade-in) loops cleanly from `-ss 1.2 -t 28.6`.
- **Smaller file:** drop `fps` to 10 or `scale` to 520.
- **Crop:** `verify.mjs` prints the canvas bounding box if the scene layout changes.
