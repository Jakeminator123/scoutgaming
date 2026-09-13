"""Repair only the verified resting-hand region of Astrid's idle matte.

RGB pixels and timing stay original. Run with the bundled NumPy Python.
"""
from pathlib import Path
import subprocess as sp
import numpy as np
import json, hashlib

root=Path(__file__).resolve().parent
repo=root.parents[4]
base=repo/'web/public/dealers/astrid'
name='idle-1_idle_idle.h264'
old=root/'original-matte.h264'
if not old.exists(): old.write_bytes((base/'actor/streams'/name).read_bytes())
def decode(path,pix):
    return sp.Popen(['ffmpeg','-v','error','-i',str(path),'-vf','scale=720:720','-f','rawvideo','-pix_fmt',pix,'-'],stdout=sp.PIPE)
rgb=decode(base/'streams'/name,'rgb24'); matte=decode(old,'gray')
dest=root/'encoded'/name
enc=sp.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','gray','-s','720x720','-r','24','-i','-',
    '-vf','scale=1440:1440','-c:v','libx264','-profile:v','main','-level:v','5.1','-crf','15','-bf','0',
    '-pix_fmt','yuv420p','-x264-params','aud=1:keyint=10000:min-keyint=10000:scenecut=0:repeat-headers=1',
    '-an','-f','h264',str(dest)],stdin=sp.PIPE)
counts=[]
while True:
    b=rgb.stdout.read(720*720*3); a=matte.stdout.read(720*720)
    if not b: assert not a; break
    assert len(b)==720*720*3 and len(a)==720*720
    source=np.frombuffer(b,np.uint8).reshape(720,720,3).astype(np.float32)
    alpha=np.frombuffer(a,np.uint8).reshape(720,720).copy()
    # Inspected full-loop hand crop. It contains hands, black suit and dark rail,
    # with no warm room pixels. The colour key follows moving source fingertips.
    crop=source[515:622,210:510]; r,g,b=crop.transpose(2,0,1)
    skin=np.minimum(np.clip((r-g-10)/15,0,1),np.clip((r-b-20)/25,0,1))
    skin*=np.clip((r-45)/35,0,1)
    before=alpha[515:622,210:510].copy()
    alpha[515:622,210:510]=np.maximum(before,np.rint(skin*255).astype(np.uint8))
    counts.append(int(np.count_nonzero(alpha[515:622,210:510]>before)))
    enc.stdin.write(alpha.tobytes())
enc.stdin.close()
assert rgb.wait()==matte.wait()==enc.wait()==0
assert len(counts)==145
(root/'result.json').write_text(json.dumps({'frames':len(counts),'changedPixelsPerFrame':counts,
    'originalMatteSha256':hashlib.sha256(old.read_bytes()).hexdigest(),
    'repairedMatteSha256':hashlib.sha256(dest.read_bytes()).hexdigest()},indent=2)+'\n')
