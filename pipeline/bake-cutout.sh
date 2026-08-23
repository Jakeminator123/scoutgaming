#!/usr/bin/env bash
# Bake a solo actor clip into a TRANSPARENT overlay (VP9 + alpha WebM).
#
# This is deliberately NOT bake-composite.sh. That one bakes a performer over
# the room plate and hands the engine a finished square, which is right for the
# dealer because she IS the panel. It is wrong for anyone who merely visits the
# table: baking a second person that way means regenerating the dealer too, and
# the regenerated take does not match her real clips, so she visibly changes for
# the length of the visit. A cutout keeps her clips untouched and layers the
# visitor over the scene instead.
#
# Usage: bake-cutout.sh <in.mp4> <out.webm>
set -euo pipefail
cd "$(dirname "$0")/.."

in=$1
out=$2
work=content/cutout
rm -rf "$work"; mkdir -p "$work/frames" "$work/masks"

ffmpeg -hide_banner -loglevel error -y -i "$in" -vsync 0 "$work/frames/f%04d.png"
./pipeline/person-mask "$work/frames" "$work/masks" | tail -1

# alpha straight from the person mask; a light blur softens the matte edge so
# he does not read as a sticker pasted on the room
ffmpeg -hide_banner -loglevel error -y \
  -framerate 24 -i "$work/frames/f%04d.png" \
  -framerate 24 -i "$work/masks/f%04d.png" \
  -filter_complex "[1:v]format=gray,gblur=sigma=1.2[a];[0:v]format=yuv420p[c];[c][a]alphamerge,format=yuva420p[out]" \
  -map "[out]" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 28 \
  -auto-alt-ref 0 -r 24 -an "$out"

rm -rf "$work"
echo "cutout $out ($(stat -f%z "$out") bytes)"
