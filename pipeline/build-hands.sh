#!/usr/bin/env bash
# Build the hands-matte track: for every deployed dealer stream, a small
# grayscale h264 stream marking which pixels of the frame's bottom band are
# HER below the table rail. The engine decodes it next to the main stream and
# uses it as alpha to repaint her forearms/hands ABOVE the table art
# (#dealer-hands, z over #table2d), so they rest ON the felt.
#
# Matte = Vision person mask AND plate-difference. The person mask alone is
# NOT enough: the scene plate has a dealer PAINTED IN (the "ghost"), and
# Vision happily masks painted people too - but ghost pixels are byte-equal to
# the plate, so anything within noise of the plate is struck from the matte.
# The difference votes as a REGION (blurred), and alpha snaps to a HARD edge
# centered on the true contour (drs=0.5): her hands read solid on the felt,
# no green tinting through the edge.
#
# Vision masks are cached in content/hands-masks/<name>/ keyed by the stream
# file's mtime, so matte-math changes re-run in seconds, not minutes.
#
# Usage: build-hands.sh [name ...]   (default: every stream except supervisor)
set -euo pipefail
cd "$(dirname "$0")/.."

BAND_Y=1124; BAND_H=316   # band v0.7806..1.0 (even height for yuv420p)
ENC=content/hands-encoded
PLATE=content/norm/bg.png
mkdir -p "$ENC" content/norm content/hands-masks
[ -f "$PLATE" ] || ffmpeg -nostdin -hide_banner -loglevel error -y -i content/scene-16x9.png \
  -vf "crop=1044:1044:854:15,scale=1440:1440" "$PLATE"

names=("$@")
if [ ${#names[@]} -eq 0 ]; then
  for f in web/public/dealer/streams/*.h264; do
    n=$(basename "$f" .h264)
    [ "$n" = "idle-1_actions_supervisor" ] && continue  # two people in frame; no matte
    names+=("$n")
  done
fi

for name in "${names[@]}"; do
  echo "== $name"
  stream=web/public/dealer/streams/$name.h264
  work=content/hands-work/$name
  cache=content/hands-masks/$name
  stamp=$(stat -f%m "$stream")
  rm -rf "$work"; mkdir -p "$work/frames" "$work/matte"
  ffmpeg -nostdin -hide_banner -loglevel error -y -f h264 -i "$stream" \
    -vsync 0 "$work/frames/f%04d.png"
  nf=$(ls "$work/frames" | wc -l | tr -d ' ')
  # Vision is the slow step; cache masks against the stream's mtime
  if [ ! -f "$cache/.stamp" ] || [ "$(cat "$cache/.stamp")" != "$stamp" ] \
     || [ "$(ls "$cache" | grep -c '^f')" != "$nf" ]; then
    rm -rf "$cache"; mkdir -p "$cache"
    ./pipeline/person-mask "$work/frames" "$cache" | tail -1
    echo "$stamp" > "$cache/.stamp"
  else
    echo "masks: cached ($nf)"
  fi

  BAND_Y=$BAND_Y BAND_H=$BAND_H WORK=$work CACHE=$cache PLATE=$PLATE python3 - <<'PYEOF'
import os, glob
import numpy as np
from PIL import Image, ImageFilter
BY, BH = int(os.environ['BAND_Y']), int(os.environ['BAND_H'])
work, cache, plate_p = os.environ['WORK'], os.environ['CACHE'], os.environ['PLATE']
plate = np.array(Image.open(plate_p).convert('RGB'), dtype=np.int16)[BY:BY+BH]
for fp in sorted(glob.glob(f'{work}/frames/*.png')):
    b = os.path.basename(fp)
    frame = np.array(Image.open(fp).convert('RGB'), dtype=np.int16)[BY:BY+BH]
    mask = np.array(Image.open(f'{cache}/{b}').convert('L'))[BY:BY+BH] > 128
    diff = (np.abs(frame - plate).max(axis=2) > 14).astype(np.float32)
    drs = np.array(Image.fromarray((diff * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5)), dtype=np.float32) / 255.0
    # hard edge at the true contour (drs=0.5): opaque hand, ~2px transition,
    # then a half-pixel feather so the cut anti-aliases instead of staircasing
    alpha = np.clip((drs - 0.48) / 0.06, 0, 1) * mask
    im = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5))
    im.save(f'{work}/matte/{b}')
print('matte frames:', len(glob.glob(f'{work}/matte/*.png')))
PYEOF

  ffmpeg -nostdin -hide_banner -loglevel error -y -framerate 24 -i "$work/matte/f%04d.png" \
    -vf "format=yuv420p" -an \
    -c:v libx264 -preset fast -profile:v main -level:v 3.1 \
    -x264-params "keyint=infinite:min-keyint=infinite:scenecut=0:bframes=0:open-gop=0:repeat-headers=1:aud=1" \
    -crf 26 -f h264 "$ENC/$name.h264"
  want=$(node -e "const i=require('./web/public/dealer/streams/index.json');const c=Object.values(i.clips).find(c=>c.file==='$name.h264');console.log(c?c.frameCount:'?')" 2>/dev/null || echo '?')
  got=$(ls "$work/matte" | wc -l | tr -d ' ')
  echo "   matte=$got streamFrames=$want"
  [ "$got" = "$want" ] || echo "   WARNING: frame count mismatch"
  rm -rf "$work"
done

node pipeline/build-index.mjs "$ENC" web/public/dealer-hands --codec avc1.4D401F --wh 1440 --h "$BAND_H"
