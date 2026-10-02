#!/usr/bin/env bash
# Re-composite a dealer clip keeping HER OWN TABLE below the contact line.
#
# The original bake cut the person out and threw the video's rail+felt away,
# then every attempt to fake the hand-table contact back read as an overlay.
# The generated video already has the real thing - her arms resting on a
# leather rail, contact shadows on the felt - so the composite keeps all
# video content below v0.845 (rail top) and the page lays the table art's
# rail exactly on it (--dealer-top anchors art rail top at v0.855). The art
# covers everything below; only the native contact strip shows.
#
# alpha = person-mask UNION below-line(v0.845, feathered). For the studio
# speak batch (gray backdrop, its own felt) the kept strip is color-graded
# toward the table-art felt. Uses cached masks (content/hands-masks).
#
# Usage: bake-with-table.sh <name>
set -euo pipefail
cd "$(dirname "$0")/.."

name=$1
stream=media/dealers/vera/runtime/indexed/streams/$name.h264
cache=content/hands-masks/$name
PLATE=media/game/source/pipeline/norm/bg.png
work=content/bake2/$name
rm -rf "$work"; mkdir -p "$work/out"
[ -f "$PLATE" ] || ffmpeg -nostdin -hide_banner -loglevel error -y -i content/scene-16x9.png \
  -vf "crop=1044:1044:854:15,scale=1440:1440" "$PLATE"

# content source: normalized frames for the re-normalized speak batch,
# else the raw clip (identical geometry to the deployed bake)
src=""; kind=raw; contentEnd=1440
line=$(grep " $name " pipeline/speak-normalize.txt || true)
if [ -n "$line" ]; then
  # re-normalized speak batch: regenerate canonical-framed frames from raw
  kind=norm
  raw=$(echo "$line" | awk '{print $1}')
  S=$(echo "$line" | awk '{print $3}'); PX=$(echo "$line" | awk '{print $4}'); PY=$(echo "$line" | awk '{print $5}')
  contentEnd=$(python3 -c "print(round(1440*$S+$PY))")
  mkdir -p "$work/src"
  ffmpeg -nostdin -hide_banner -loglevel error -y -i "$raw" -vsync 0 \
    -vf "scale='round(iw*$S/2)*2':'round(ih*$S/2)*2',pad=1440:1440:$PX:$PY:black,fps=24" \
    "$work/src/f%04d.png"
  src=$work/src
else
  for d in content/raw-all content/raw content/raw2 content/raw-super content/raw-speak2 content/raw-speak; do
    [ -f "$d/$name.mp4" ] && { srcmp4=$d/$name.mp4; break; }
  done
  [ -n "${srcmp4:-}" ] || { echo "NO SOURCE for $name"; exit 1; }
  mkdir -p "$work/src"
  ffmpeg -nostdin -hide_banner -loglevel error -y -i "$srcmp4" -vsync 0 "$work/src/f%04d.png"
  src=$work/src
fi

# the SOURCE frames are the truth for frame count; the deployed stream may
# carry fps-filter duplicates from an older pipeline (fair_rng: 225 vs 217)
N=$(ls "$src" | wc -l | tr -d ' ')
[ "$N" -gt 0 ] || { echo "no source frames: $name"; exit 1; }
if [ ! -f "$cache/.stamp" ] || [ "$(ls "$cache" | grep -c '^f')" != "$N" ]; then
  echo "   masks: regenerating from source ($N frames)"
  rm -rf "$work/masks"; mkdir -p "$work/masks"
  ./pipeline/person-mask "$src" "$work/masks" | tail -1
  cache=$work/masks
fi

WORK=$work CACHE=$cache PLATE=$PLATE SRC=$src KIND=$kind CE=$contentEnd N=$N python3 - <<'PYEOF'
import os, glob
import numpy as np
from PIL import Image, ImageFilter
work, cache, plate_p = os.environ['WORK'], os.environ['CACHE'], os.environ['PLATE']
src, kind, ce, N = os.environ['SRC'], os.environ['KIND'], int(os.environ['CE']), int(os.environ['N'])
plate = np.array(Image.open(plate_p).convert('RGB'), dtype=np.float32)
LINE = round(0.845*1440)                     # keep everything below the rail top
TARGET = np.array([69.,117.,84.])            # table-art felt median
rows = np.arange(1440, dtype=np.float32)[:, None]
cols = np.arange(1440, dtype=np.float32)[None, :]
below = np.clip((rows-LINE)/8, 0, 1)         # feathered keep-region
# center span keeps video from v0.79: her folded wrists/fingertips live
# there, and Vision's per-frame finger jitter otherwise lets the plate
# flicker through the contact line. Her torso always covers this box.
CLINE = round(0.79*1440)
cbox = np.clip((rows-CLINE)/8,0,1) * np.clip((cols-420)/40,0,1) * np.clip((1020-cols)/40,0,1)
below = np.maximum(below, cbox)
if ce < 1440: below = below * np.clip((ce-4-rows)/6, 0, 1)  # normalized pad: nothing there

srcs = sorted(glob.glob(f'{src}/*.png'))[:N]
masks = sorted(glob.glob(f'{cache}/f*.png'))[:N]
assert len(srcs) == len(masks) == N, f'{len(srcs)} vs {len(masks)} vs {N}'
gain = None
if kind == 'norm':                           # grade the studio felt strip
    mid = np.array(Image.open(srcs[len(srcs)//2]).convert('RGB'), dtype=np.float32)
    samp = np.concatenate([mid[LINE+10:ce-10, 200:450].reshape(-1,3), mid[LINE+10:ce-10, 1000:1240].reshape(-1,3)])
    med = np.median(samp, axis=0)
    gain = np.clip(TARGET/np.maximum(med,1), 0.5, 2.5)
# the studio speak batch lights her flat and cool vs the warm room clips;
# affine grade (mean/std matched on person pixels vs canonical idle) so she
# reads as the same footage when a speech clip splices in
PERSON_A = np.array([1.0286, 0.9892, 0.9654])
PERSON_B = np.array([7.33, 2.39, -3.23])
def one(i):
    fg = np.array(Image.open(srcs[i]).convert('RGB'), dtype=np.float32)
    pm = np.array(Image.open(masks[i]).convert('L'), dtype=np.float32)/255.0
    pm = np.array(Image.fromarray((pm*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0)), dtype=np.float32)/255.0
    if gain is not None:
        pg = np.clip(fg*PERSON_A + PERSON_B, 0, 255)
        fg = fg*(1-pm[...,None]) + pg*pm[...,None]
    if gain is not None:
        w = (below * (1-pm))[..., None]      # felt only, not her
        fg = fg*(1-w) + np.clip(fg*gain,0,255)*w
    a = np.maximum(pm, below)
    out = plate*(1-a[...,None]) + fg*a[...,None]
    # ppm: no compression, ~6x faster than png; ffmpeg reads it the same way
    Image.fromarray(out.astype(np.uint8)).save(f"{work}/out/f{i+1:04d}.ppm")
from multiprocessing import get_context
with get_context('fork').Pool(6) as pool:  # stdin script: spawn can't re-import
    pool.map(one, range(N))
print('composited', N)
PYEOF

ffmpeg -nostdin -hide_banner -loglevel error -y -framerate 24 -i "$work/out/f%04d.ppm" \
  -vf "format=yuv420p" -an \
  -c:v libx264 -preset slow -profile:v main -level:v 4.0 \
  -x264-params "keyint=infinite:min-keyint=infinite:scenecut=0:bframes=0:open-gop=0:repeat-headers=1:aud=1" \
  -crf 21 -f h264 "media/game/source/pipeline/encoded2/$name.h264"
echo "baked-with-table $name ($(stat -f%z "media/game/source/pipeline/encoded2/$name.h264") bytes)"
rm -rf "$work"
