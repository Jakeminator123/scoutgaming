"""Build a bounded pickup-only pace review; never touches gameplay or source media."""
from pathlib import Path
import hashlib
import json
import os
import subprocess

here = Path(__file__).resolve().parent
source = here.parent / 'kling-primitive.mp4'
output = here / 'pickup-60fps.mp4'
temporary = here / 'pickup-60fps.tmp.mp4'

def probe(path):
    result = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,avg_frame_rate,nb_frames,duration',
        '-of', 'json', str(path)], check=True, capture_output=True, text=True)
    return json.loads(result.stdout)['streams'][0]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

original = probe(source)
assert (original['width'], original['height'], original['avg_frame_rate'],
    int(original['nb_frames'])) == (1920, 1080, '24/1', 73), original
source_hash = sha(source)
indices = list(range(0, 73, 3))
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-an',
    '-vf', r'select=not(mod(n\,3)),settb=1/60,setpts=N',
    '-r', '60', '-fps_mode', 'cfr', '-frames:v', str(len(indices)), '-c:v', 'libx264',
    '-profile:v', 'high', '-crf', '14', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', str(temporary)], check=True)
encoded = probe(temporary)
assert (encoded['width'], encoded['height'], encoded['avg_frame_rate'],
    int(encoded['nb_frames'])) == (1920, 1080, '60/1', len(indices)), encoded
assert sha(source) == source_hash, 'Original source changed during review build'
os.replace(temporary, output)
receipt = {
    'status': 'Pickup-only pace candidate; not a completed deal or gameplay acceptance',
    'sourceSHA256': source_hash, 'outputSHA256': sha(output),
    'source': original, 'output': encoded,
    'sourceFrameIndices': indices,
    'outputFrames': [{'outputFrame': n, 'outputTime': n / 60,
        'sourceFrame': f, 'sourceTime': f / 24} for n, f in enumerate(indices)],
    'policy': 'Native frame selection only. No interpolation, actor warp, or duplicate frames. '
        'First and last native frames retained.48 intermediate source frames omitted. '
        'CRF14 encoding is lossy; original source remains unchanged.',
    'remaining': 'Ends mid-extraction. Requires original shoe compositing, card cleanup, '
        'turnover, delivery, empty return, and full gameplay verification.'
}
(here / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'frames': len(indices), 'duration': encoded['duration'],
    'sourceUnchanged': True, 'output': str(output)}))
