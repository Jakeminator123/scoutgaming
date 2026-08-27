#!/usr/bin/env bash
# Re-bake ONE drifted clip to the canonical framing, measured not eyeballed.
#
# Seedance re-renders drift (the 08-23 speak batch came back ~20% closer and
# lower), so the dealer visibly grows whenever such a clip splices in. The fix
# is at the pixels: scale+pad the RAW clip so head top / head centre / shoulder
# width land exactly on the canonical idle framing, then run the normal
# cutout-bake (person mask -> composite over the scene plate) and encode.
# Scale/pad numbers come from mask row-profiles (see stats.json in the session
# scratchpad); they are passed in, this script just applies them.
#
# Usage: normalize-bake.sh <raw.mp4> <name> <scale> <padx> <pady>
#   <name>  stream stem, e.g. idle-1_speak_fair_rng
#   <scale> e.g. 0.833  (raw is scaled by this, <1 shrinks her)
#   <padx>/<pady>  top-left offset of the scaled image on the 1440 canvas
# Output: content/encoded2/<name>.h264, work kept in content/norm/<name>/
#         (frames+masks stay: build-hands.sh reuses the masks for the matte)
set -euo pipefail
cd "$(dirname "$0")/.."

raw=$1; name=$2; S=$3; PX=$4; PY=$5
work=content/norm/$name
rm -rf "$work"; mkdir -p "$work/frames" "$work/masks"

# scene plate for the dealer window (same crop as bake-composite.sh)
BG=content/norm/bg.png
[ -f "$BG" ] || ffmpeg -nostdin -hide_banner -loglevel error -y -i content/scene-16x9.png \
  -vf "crop=1044:1044:854:15,scale=1440:1440" "$BG"

# raw -> canonical-framed 1440x1440 frames (black borders die with the mask)
ffmpeg -nostdin -hide_banner -loglevel error -y -i "$raw" -vsync 0 \
  -vf "scale='round(iw*$S/2)*2':'round(ih*$S/2)*2',pad=1440:1440:$PX:$PY:black,fps=24" \
  "$work/frames/f%04d.png"
./pipeline/person-mask "$work/frames" "$work/masks" | tail -1

# composite over the plate, then encode straight to the stream format
ffmpeg -nostdin -hide_banner -loglevel error -y \
  -framerate 24 -i "$work/frames/f%04d.png" \
  -framerate 24 -i "$work/masks/f%04d.png" \
  -i "$BG" \
  -filter_complex "[2:v]format=gbrp[bg];[0:v]format=gbrp[fg];[1:v]format=gray,gblur=sigma=1.0[m];[bg][fg][m]maskedmerge,format=yuv420p[out]" \
  -map "[out]" -an \
  -c:v libx264 -preset slow -profile:v main -level:v 4.0 \
  -x264-params "keyint=infinite:min-keyint=infinite:scenecut=0:bframes=0:open-gop=0:repeat-headers=1:aud=1" \
  -crf 21 -f h264 "content/encoded2/$name.h264"
echo "normalized $name -> content/encoded2/$name.h264 ($(stat -f%z "content/encoded2/$name.h264") bytes)"
