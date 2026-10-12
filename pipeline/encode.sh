#!/usr/bin/env bash
# Encode a generated dealer clip to the stream format the engine consumes:
# square 1440x1440, 24 fps, raw Annex-B H.264 (profile main, level 4.0),
# a single IDR at frame 0, AUD markers so the indexer can split access units.
#
# Usage: encode.sh <in.mp4> <out.h264> [--trim-last]
#   --trim-last  drop the final frame (loop clips end on the canonical pose
#                that the next clip starts with; keeping both shows a freeze)
set -euo pipefail
in=$1; out=$2; trim=${3:-}

vf="crop='min(iw,ih)':'min(iw,ih)',scale=1440:1440,fps=24,format=yuv420p"
if [[ "$trim" == "--trim-last" ]]; then
  frames=$(ffprobe -v error -count_frames -select_streams v:0 \
    -show_entries stream=nb_read_frames -of csv=p=0 "$in")
  vf="$vf,select='lt(n,$((frames-1)))'"
fi

ffmpeg -hide_banner -loglevel error -y -i "$in" -an \
  -vf "$vf" -vsync 0 \
  -c:v libx264 -preset slow -profile:v main -level:v 4.0 \
  -x264-params "keyint=infinite:min-keyint=infinite:scenecut=0:bframes=0:open-gop=0:repeat-headers=1:aud=1" \
  -crf 21 -f h264 "$out"
echo "encoded $out ($(stat -f%z "$out") bytes)"
