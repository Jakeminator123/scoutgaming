#!/usr/bin/env python3
# Zero-credit rescue for a clip whose mouth paces slower than its audio
# (seedance mouthing through apad silence): retime ONLY the speech span of
# the VIDEO to the audio's speech duration - head and tail stay 1.0 so the
# idle splice frames are untouched and the audio stays completely natural.
# The onset gap (v0-a0) becomes the clip's audioDelayMs stamp.
# Usage: retime-video-warp.py <base> <key> <v0> <v1> <a0> <a1>
import subprocess, sys, os, json, shutil, tempfile
FPS=24
base,key=sys.argv[1],sys.argv[2]
v0,v1,a0,a1=(float(x) for x in sys.argv[3:7])
idx_path=f'{base}/streams/index.json'
idx=json.load(open(idx_path))
c=idx['clips'][f'idle-1/speak/{key}']
stream=f"{base}/streams/{c['file']}"
os.makedirs(f'{base}/streams/orig',exist_ok=True)
bak=f"{base}/streams/orig/{c['file']}"
if not os.path.exists(bak): shutil.copy(stream,bak)
# frame count must come from the pristine backup, not the (possibly already
# retimed) index entry - iterating from the index double-compresses
import glob as _g
n=None
r=(v1-v0)/(a1-a0)          # source advance rate inside the speech span
def src_frame(t):
    if t<v0: s=t
    elif t<v0+(a1-a0): s=v0+(t-v0)*r
    else: s=v1+(t-(v0+(a1-a0)))
    return min(n-1,max(0,int(round(s*FPS/1000))))
with tempfile.TemporaryDirectory() as td:
    subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-f','h264','-r',str(FPS),'-i',bak,
        '-vsync','0',f'{td}/f%04d.png'],check=True)
    n=len(_g.glob(f'{td}/f*.png')); end=n*1000/FPS
    out_dur=v0+(a1-a0)+(end-v1)
    m=int(round(out_dur*FPS/1000))
    order=[src_frame(i*1000/FPS) for i in range(m)]
    lst=f'{td}/list.txt'
    with open(lst,'w') as fh:
        for s in order: fh.write(f"file 'f{s+1:04d}.png'\nduration {1/FPS:.6f}\n")
    subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-f','concat','-safe','0','-i',lst,
        '-r',str(FPS),'-c:v','libx264','-preset','slow','-crf','19','-pix_fmt','yuv420p',
        '-x264-params','keyint=infinite:min-keyint=infinite:scenecut=0:aud=1',
        '-an','-f','h264','-y',stream],check=True)
delay=max(0,int(round(v0-a0)))
print(json.dumps({'key':key,'frames_in':n,'frames_out':m,'speed':round(1/r,2),'audioDelayMs':delay}))
