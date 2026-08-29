#!/usr/bin/env python3
"""Trim leading frames from a Seedance speak take and re-encode Annex-B H.264
the same way pipeline/encode.sh does (square 1440, 24fps, main@4.0, infinite
GOP, AUD). Dealer-generic; caller picks which dealers/keys to run.

Usage:
  python3 pipeline/trim-speak-start.py <dealer> <key> <trim_frames>
"""
import os, sys, subprocess, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def encode_trimmed(src, dest, skip_frames):
    """Single-pass encode matching encode.sh, dropping the first skip_frames
    of the 24fps timeline so the output still starts on an IDR + AUD."""
    vf = (
        "crop='min(iw,ih)':'min(iw,ih)',scale=1440:1440,fps=24,"
        f"select='gte(n,{int(skip_frames)})',setpts=PTS-STARTPTS,format=yuv420p"
    )
    cmd = [
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-an',
        '-vf', vf, '-vsync', '0',
        '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'main', '-level:v', '4.0',
        '-x264-params',
        'keyint=infinite:min-keyint=infinite:scenecut=0:bframes=0:open-gop=0:repeat-headers=1:aud=1',
        '-crf', '21', '-f', 'h264', dest,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f'ffmpeg failed for {src} -> {dest}: {r.stderr[-400:]}')
    return os.path.getsize(dest)

def main():
    if len(sys.argv) != 4:
        print('usage: trim-speak-start.py <dealer> <key> <trim_frames>', file=sys.stderr)
        sys.exit(2)
    dealer, key, skip = sys.argv[1], sys.argv[2], int(sys.argv[3])
    src = f'{ROOT}/content/dealers/{dealer}/raw/speak_{key}.mp4'
    if not os.path.exists(src):
        raise SystemExit(f'missing raw {src}')
    stage_dir = f'{ROOT}/content/dealers/{dealer}/stage'
    stream = f'{ROOT}/web/public/dealers/{dealer}/streams/idle-1_speak_{key}.h264'
    os.makedirs(stage_dir, exist_ok=True)
    os.makedirs(os.path.dirname(stream), exist_ok=True)
    stage = f'{stage_dir}/idle-1_speak_{key}.h264'
    n = encode_trimmed(src, stage, skip)
    subprocess.check_call(['cp', stage, stream])
    print(f'{dealer}/{key}: skipped {skip} frames, {n} bytes -> {stream}')

if __name__ == '__main__':
    main()
