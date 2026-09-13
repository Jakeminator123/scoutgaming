#!/bin/sh
set -eu
reference_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
watch_runtime=/Users/solvifyab/.codex/tools/watch-runtime/bin
watch_skill=/Users/solvifyab/.codex/tools/claude-video/skills/watch
export PATH="$watch_runtime:$PATH"
reference_source="$reference_root/watch/download/video.mp4"
if [ ! -f "$reference_source" ]; then
  reference_source='https://www.youtube.com/watch?v=dfE-7NV4Vh8'
fi
exec "$watch_runtime/python" "$watch_skill/scripts/watch.py" "$reference_source" --detail balanced --max-frames 24 --no-whisper "$@"
