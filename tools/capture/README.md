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
# Crop: the canvas region, with ~4px shaved off the left (a grey scene edge) and
# even dimensions for libx264. Start at -ss 4.0 to open on a clean single monitor:
# the initial fade-in (~first 3s) renders near-black and looks like a buggy page load.
CROP="crop=652:600:165:220"

# Master MP4: one full layout cycle starting on the single monitor, crisp.
ffmpeg -y -ss 4.0 -t 28.6 -i video/wall.webm -vf "$CROP" \
  -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart ../../assets/moncom-wall.mp4

# Hero GIF — full layout loop, inline-sized (~380px), palette-optimized.
# Encoded from the MP4 master (already cropped to the full cycle), so it loops cleanly.
ffmpeg -y -i ../../assets/moncom-wall.mp4 \
  -vf "fps=10,scale=380:-1:flags=lanczos,palettegen=max_colors=64:stats_mode=diff" palette.png
ffmpeg -y -i ../../assets/moncom-wall.mp4 -i palette.png \
  -lavfi "fps=10,scale=380:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5" \
  ../../assets/moncom-wall.gif
```

## Tuning
- **Smaller / larger GIF:** change `scale=380` and `fps`. At ~380px/10fps/64 colors
  the full ~28.6s loop is ≈2.4MB. The MP4 master is the full cycle, cropped.
- **Smaller file:** drop `fps` to 10 or `scale` to 520.
- **Crop:** `verify.mjs` prints the canvas bounding box if the scene layout changes.
