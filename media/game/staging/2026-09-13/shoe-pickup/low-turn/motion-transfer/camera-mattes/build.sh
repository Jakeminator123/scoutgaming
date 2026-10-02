#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
ffmpeg -v error -i ../camera-locked.mp4 -map 0:v:0 -fps_mode passthrough -start_number 0 -y frames/%04d.png
swift ../../../../../../../pipeline/person-mask.swift frames person
/Users/solvifyab/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 verify.py
