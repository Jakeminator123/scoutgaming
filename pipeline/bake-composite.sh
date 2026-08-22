#!/usr/bin/env bash
# Bake the dealer cutout over the scene plate so the panel is an invisible
# window: per-frame person mask (Vision) -> composite over the exact scene
# crop the panel occupies at the design aspect (16:9) -> re-encoded clip.
#
# Panel geometry (styles.css): --dealer-h 68vh, --dealer-top 1vh, centered.
# At 16:9 the scene (2752x1536) covers height-fit (15.36 px/vh), so the video
# square maps to scene rect x=854 y=15 w=1044 h=1044. bg.png = that crop.
set -euo pipefail
cd "$(dirname "$0")/.."

RAW=${1:-content/raw2}
WORK=content/bake
BG=$WORK/bg.png
mkdir -p "$WORK"

# 1. background plate for the full video square
ffmpeg -hide_banner -loglevel error -y -i content/scene-16x9.png \
  -vf "crop=1044:1044:854:15,scale=1440:1440" "$BG"

# 2. per clip: frames -> masks -> composite -> intermediate mp4
for f in "$RAW"/*.mp4; do
  b=$(basename "$f" .mp4)
  echo "== $b"
  rm -rf "$WORK/frames" "$WORK/masks"
  mkdir -p "$WORK/frames" "$WORK/masks"
  ffmpeg -hide_banner -loglevel error -y -i "$f" -vsync 0 "$WORK/frames/f%04d.png"
  ./pipeline/person-mask "$WORK/frames" "$WORK/masks" | tail -1
  ffmpeg -hide_banner -loglevel error -y \
    -framerate 24 -i "$WORK/frames/f%04d.png" \
    -framerate 24 -i "$WORK/masks/f%04d.png" \
    -i "$BG" \
    -filter_complex "[2:v]scale=1440:1440,format=gbrp[bg];[0:v]format=gbrp[fg];[1:v]format=gray,gblur=sigma=1.0[m];[bg][fg][m]maskedmerge,format=yuv420p[out]" \
    -map "[out]" -c:v libx264 -preset fast -crf 10 -r 24 "$WORK/$b.mp4"
done
rm -rf "$WORK/frames" "$WORK/masks"
echo "baked: $(ls "$WORK"/*.mp4 | wc -l | tr -d ' ') clips in $WORK"
