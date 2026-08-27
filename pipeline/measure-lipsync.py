#!/usr/bin/env python3
# Measure per-clip audio-vs-mouth lag: cross-correlate the mouth-motion track
# (frame diffs in the lip region) against the speech envelope at 24fps.
# Positive lag = mouth trails audio by that many ms -> delay the audio start.
import subprocess, io, sys, json
import numpy as np
from PIL import Image
FPS=24
def mouth_track(stream):
    out=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-f','h264','-i',stream,
        '-vf','crop=200:140:660:480,scale=50:35','-vsync','0','-f','image2pipe','-vcodec','png','-'],
        capture_output=True).stdout
    sig=b'\x89PNG'; st=[i for i in range(len(out)) if out[i:i+4]==sig]
    fr=[np.array(Image.open(io.BytesIO(out[s:(st[i+1] if i+1<len(st) else len(out))])).convert('L'),dtype=np.float32) for i,s in enumerate(st)]
    return np.array([0.0]+[np.abs(fr[i]-fr[i-1]).mean() for i in range(1,len(fr))])
def audio_env(mp3, nframes):
    out=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',mp3,'-f','s16le','-ac','1','-ar','24000','-'],capture_output=True).stdout
    a=np.abs(np.frombuffer(out,dtype=np.int16).astype(np.float32))
    hop=1000  # 24 windows/s
    env=np.array([a[i*hop:(i+1)*hop].mean() if (i+1)*hop<=len(a) else 0.0 for i in range(nframes)])
    return env
def lag_ms(stream, mp3):
    m=mouth_track(stream); e=audio_env(mp3,len(m))
    m=(m-m.mean())/(m.std()+1e-6); e=(e-e.mean())/(e.std()+1e-6)
    best,bl=-1e9,0
    for lag in range(-12,13):           # +/- 500ms
        if lag>=0: c=(m[lag:]*e[:len(m)-lag]).mean()
        else:      c=(m[:lag]*e[-lag:]).mean()
        if c>best: best,bl=c,lag
    return round(bl*1000/FPS), round(best,3)
if __name__=='__main__':
    ms,corr=lag_ms(sys.argv[1],sys.argv[2])
    print(json.dumps({'lagMs':ms,'corr':corr}))
