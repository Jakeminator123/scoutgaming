#!/bin/sh
set -eu
cd "$(dirname "$0")"
out=../../../../web/public/review/astrid-a9fa1da6
mkdir -p "$out"
ffmpeg -v error -y -framerate 24 -i rgba/%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 18 -auto-alt-ref 0 -row-mt 1 -an "$out/astrid-transparent.webm"
ffmpeg -v error -y -framerate 24 -i frames/%04d.png -framerate 24 -i alpha/%04d.png -filter_complex '[0:v]format=yuv420p[rgb];[1:v]format=yuv420p[mask];[rgb][mask]vstack=inputs=2[v]' -map '[v]' -c:v libx264 -crf 15 -bf 0 -pix_fmt yuv420p -an -movflags +faststart "$out/astrid-packed.mp4"
ffmpeg -v error -y -framerate 24 -i preview-frames/%04d.png -c:v libx264 -crf 17 -pix_fmt yuv420p -an -movflags +faststart "$out/preview.mp4"
cp preview-frames/0033.png "$out/poster.png"
