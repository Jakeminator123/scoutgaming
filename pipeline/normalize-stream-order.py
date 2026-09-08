#!/usr/bin/env python3
"""Remove B-frame reordering for the sequential-timestamp WebCodecs player.
Usage: normalize-stream-order.py <dealer asset base>
Preserves all clip metadata, and rebuilds byte offsets from the new stream.
"""
import json, pathlib, subprocess, sys, tempfile
base = pathlib.Path(sys.argv[1])
index_path = base / 'streams/index.json'
index = json.loads(index_path.read_text())

def frame_types(path):
    return subprocess.check_output(['ffprobe', '-v', 'error', '-f', 'h264',
        '-show_entries', 'frame=pict_type', '-of', 'csv=p=0', str(path)], text=True).splitlines()

def offsets(data):
    starts = []
    i = 0
    while i < len(data) - 4:
        prefix = 4 if data[i:i+4] == b'\x00\x00\x00\x01' else 3 if data[i:i+3] == b'\x00\x00\x01' else 0
        if prefix:
            if data[i+prefix] & 31 == 9:
                starts.append(i)
            i += prefix
        else:
            i += 1
    if not starts or starts[0] != 0:
        raise ValueError('Missing leading access-unit delimiter')
    return [[a, b-a] for a,b in zip(starts, starts[1:]+[len(data)])]

for key, clip in index['clips'].items():
    path = base / 'streams' / clip['file']
    before = [v for v in frame_types(path) if v.strip(',')]
    if not any(v.startswith('B') for v in before):
        continue
    with tempfile.TemporaryDirectory() as folder:
        target = pathlib.Path(folder) / path.name
        subprocess.run(['ffmpeg','-nostdin','-v','error','-f','h264','-r',str(clip.get('fps',24)),
            '-i',str(path),'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18',
            '-profile:v','main','-level:v','4.0','-pix_fmt','yuv420p',
            '-x264-params','bframes=0:keyint=infinite:min-keyint=infinite:scenecut=0:open-gop=0:repeat-headers=1:aud=1',
            '-f','h264',str(target)],check=True)
        after = [v for v in frame_types(target) if v.strip(',')]
        if len(after) != len(before) or any(v.startswith('B') for v in after):
            raise ValueError(f'Frame order/count validation failed: {key}')
        data = target.read_bytes()
        frames = offsets(data)
        if len(frames) != len(after):
            raise ValueError(f'Access-unit count mismatch: {key}')
        path.write_bytes(data)
        clip.update(frames=frames,frameCount=len(frames))
        index_path.write_text(json.dumps(index))
        print(f'{key}: {len(frames)} frames, display order verified',flush=True)
