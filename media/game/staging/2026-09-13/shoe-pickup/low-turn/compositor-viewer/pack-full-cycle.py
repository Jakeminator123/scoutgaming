"""Pack separate actor RGB/RG using an explicit shared 3x/60fps sample ledger.

This is an unapproved review asset. It contains no independent game-card art.
"""
import hashlib
import argparse
import json
import math
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, '/tmp/astrid-optical-flow')
import cv2
import numpy as np

here = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, help='Separate candidate directory containing aligned actor frames and receipt.json')
args = parser.parse_args()
source = (args.source or (here.parent / 'motion-transfer/camera-review/seven-targets/far-left-anchor/motion/release-continuation/motion-registration/full-cycle-candidate-v2')).resolve()
output = source / 'web-surface'
output.mkdir(exist_ok=True)
receipt = json.loads((source / 'receipt.json').read_text())
rows = receipt['ledger']
fps, speed, native_fps = 60, 3, 24
# Include the last authored ready pose, even when ordinary duration rounding
# would omit it. Every selected actor frame and prop pose uses this same map.
last = math.ceil((len(rows) - 1) / (native_fps * speed) * fps)
samples = [min(len(rows)-1, math.floor(i * native_fps * speed / fps + .5)) for i in range(last + 1)]
video = output / 'actor-packed-3x60.mp4'
command = ['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1920x2160','-r',str(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','14','-pix_fmt','yuv420p','-movflags','+faststart',str(video)]
proc = subprocess.Popen(command, stdin=subprocess.PIPE)
ledger = []
clamped = []
try:
    for frame, native in enumerate(samples):
        rgb_path = source / 'actor-rgb' / f'{native:04d}.png'
        rg_path = source / 'actor-rg' / f'{native:04d}.png'
        rgb, rg = cv2.imread(str(rgb_path)), cv2.imread(str(rg_path))
        if rgb is None or rg is None or rgb.shape != (1080,1920,3) or rg.shape != rgb.shape:
            raise ValueError(f'Missing or invalid aligned actor pair {native}')
        excess = int(np.count_nonzero(rg[:,:,1] > rg[:,:,2]))
        if excess:
            clamped.append({'sequenceFrame':native,'pixels':excess})
            rg[:,:,1] = np.minimum(rg[:,:,1], rg[:,:,2])
        proc.stdin.write(np.concatenate([rgb,rg],axis=0).tobytes())
        ledger.append({**rows[native], 'frame':frame, 'sequenceFrame':native, 'pts':frame/fps,
                       'actorRGBSha256':hashlib.sha256(rgb_path.read_bytes()).hexdigest(),
                       'actorRGSha256':hashlib.sha256(rg_path.read_bytes()).hexdigest()})
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError('Packed actor encoding failed')
except BaseException:
    proc.kill()
    proc.wait()
    raise
probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=width,height,avg_frame_rate,nb_read_frames,duration','-of','json',str(video)]))
assert int(probe['streams'][0]['nb_read_frames']) == len(ledger)
(output / 'receipt.json').write_text(json.dumps({
    'status':'unapproved-independent-surface-review', 'fps':fps, 'speed':speed,
    'sourceReceiptSha256':hashlib.sha256((source/'receipt.json').read_bytes()).hexdigest(),
    'actorReceiptSha256':hashlib.sha256((source/'actor-receipt.json').read_bytes()).hexdigest() if (source/'actor-receipt.json').exists() else None,
    'videoSha256':hashlib.sha256(video.read_bytes()).hexdigest(), 'probe':probe,
    'foregroundClamp':{'policy':'G=min(G,R), matching packedGPU; R and source RGB unchanged before encoding','frames':clamped},
    'policy':'Top RGB/bottom RG; one shared nearest-source sampling map. Final ready pose retained. Original generated paper may remain where draft masks fail. No new game-card art baked. No visual approval or public gameplay promotion.',
    'ledger':ledger
},indent=2))
print(json.dumps({'frames':len(ledger),'finalSequenceFrame':samples[-1],'video':str(video),'probe':probe}))
