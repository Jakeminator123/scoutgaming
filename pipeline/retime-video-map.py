#!/usr/bin/env python3
# Piecewise zero-credit rescue: map N video spans (mouth waves) onto N audio
# spans (phrases) in one clip. Head/tail and inter-wave gaps retime linearly,
# splice frames stay, audio stays natural. Generalizes retime-video-warp.py.
# Output timeline = audio timeline + D where D = stamp (first wave onset gap).
# Usage: retime-video-map.py <base> <key> '[[v0,v1,a0,a1],...]'
import subprocess, sys, os, json, shutil, tempfile, glob
FPS=24
base,key=sys.argv[1],sys.argv[2]
pairs=json.loads(sys.argv[3])
idx_path=f'{base}/streams/index.json'
idx=json.load(open(idx_path))
c=idx['clips'][f'idle-1/speak/{key}']
stream=f"{base}/streams/{c['file']}"
os.makedirs(f'{base}/streams/orig',exist_ok=True)
bak=f"{base}/streams/orig/{c['file']}"
if not os.path.exists(bak): shutil.copy(stream,bak)
D=max(0.0,pairs[0][0]-pairs[0][2])
with tempfile.TemporaryDirectory() as td:
    subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-f','h264','-r',str(FPS),'-i',bak,
        '-vsync','0',f'{td}/f%04d.png'],check=True)
    n=len(glob.glob(f'{td}/f*.png')); end=n*1000/FPS
    # control points: (source_time, output_time)
    cp=[(0.0,0.0)]
    for v0,v1,a0,a1 in pairs:
        cp.append((float(v0),D+a0)); cp.append((float(v1),D+a1))
    cp.append((end, cp[-1][1]+(end-pairs[-1][1])))
    for i in range(1,len(cp)):
        if cp[i][0]<=cp[i-1][0] or cp[i][1]<=cp[i-1][1]:
            sys.exit(f'non-monotonic control points at {i}: {cp[i-1]} -> {cp[i]}')
    out_end=cp[-1][1]
    m=int(round(out_end*FPS/1000))
    def src_time(t):
        for i in range(1,len(cp)):
            (s0,o0),(s1,o1)=cp[i-1],cp[i]
            if t<=o1: return s0+(t-o0)*(s1-s0)/(o1-o0)
        return end
    order=[min(n-1,max(0,int(round(src_time(i*1000/FPS)*FPS/1000)))) for i in range(m)]
    lst=f'{td}/list.txt'
    with open(lst,'w') as fh:
        for s in order: fh.write(f"file 'f{s+1:04d}.png'\nduration {1/FPS:.6f}\n")
    subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-f','concat','-safe','0','-i',lst,
        '-r',str(FPS),'-c:v','libx264','-preset','slow','-crf','19','-pix_fmt','yuv420p',
        '-x264-params','keyint=infinite:min-keyint=infinite:scenecut=0:aud=1',
        '-an','-f','h264','-y',stream],check=True)
speeds=[round((v1-v0)/max(1.0,(a1-a0)),2) for v0,v1,a0,a1 in pairs]
print(json.dumps({'key':key,'frames_in':n,'frames_out':m,'wave_speeds':speeds,'audioDelayMs':int(round(D))}))
