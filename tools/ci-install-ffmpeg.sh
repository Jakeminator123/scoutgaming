#!/usr/bin/env bash
set -euo pipefail
cache_dir="${FFMPEG_CACHE_DIR:?FFMPEG_CACHE_DIR is required}"
# The only writable/removable directory is the action's explicit package cache.
if [[ "$cache_dir" != /home/runner/apt-cache/ffmpeg ]]; then
  echo "Unexpected FFmpeg cache directory" >&2
  exit 1
fi
mkdir -p "$cache_dir"
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
  echo "save=false" >> "$GITHUB_OUTPUT"
  ffmpeg -version | head -n 1
  jq --version
  exit 0
fi
shopt -s nullglob
debs=( "$cache_dir"/*.deb )
from_cache=0
if [ "${#debs[@]}" -gt 0 ]; then
  # A cache hit must not silently download missing dependencies from Ubuntu.
  if sudo apt-get --no-download install -y --no-install-recommends "${debs[@]}"; then
    from_cache=1
  fi
fi
if [ "$from_cache" -eq 0 ]; then
  ubuntu_sources=()
  # FFmpeg/jq use Ubuntu only; unrelated third-party repositories must not block CI.
  if [ -f /etc/apt/sources.list.d/ubuntu.sources ]; then
    ubuntu_sources=(-o Dir::Etc::sourcelist=/etc/apt/sources.list.d/ubuntu.sources -o Dir::Etc::sourceparts=-)
  fi
  for attempt in 1 2 3; do
    # Failed APT downloads can leave a root-owned partial directory.
    sudo rm -rf "$cache_dir"
    mkdir -p "$cache_dir"
    if sudo apt-get "${ubuntu_sources[@]}" -o Acquire::Retries=3 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 update -qq \
      && sudo apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 install -y -qq --download-only --no-install-recommends -o "Dir::Cache::archives=${cache_dir}/" ffmpeg jq; then
      debs=( "$cache_dir"/*.deb )
      if [ "${#debs[@]}" -gt 0 ] && sudo apt-get --no-download install -y --no-install-recommends "${debs[@]}"; then
        break
      fi
    fi
    if [ "$attempt" = 3 ]; then exit 1; fi
    sleep 20
  done
fi
# Never save an installation that is missing any of the tools required by tests.
command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null
command -v jq >/dev/null
sudo chown -R "$USER:$USER" "$cache_dir"
find "$cache_dir" -mindepth 1 -maxdepth 1 ! -name '*.deb' -exec rm -rf {} +
if [ "$from_cache" -eq 0 ]; then
  echo "save=true" >> "$GITHUB_OUTPUT"
else
  echo "save=false" >> "$GITHUB_OUTPUT"
fi
ffmpeg -version | head -n 1
jq --version
