#!/usr/bin/env python3
# Warp a line's audio to its clip's measured mouth timing. The generator's
# mouth lag DRIFTS within a clip, so a constant offset can't hold sync
# through a monolog. This measures lag in sliding windows, builds a
# monotonic audio->video time map, and time-stretches the audio piecewise
# (ffmpeg atempo) so the voice follows the mouth for the whole line.
# Originals are kept in audio/en/orig/ and always used as the warp source,
# so re-warping after a clip regeneration is safe.
import subprocess, io, sys, os, shutil, json
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
def audio_env(mp3, n):
    out=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',mp3,'-f','s16le','-ac','1','-ar','24000','-'],capture_output=True).stdout
    a=np.abs(np.frombuffer(out,dtype=np.int16).astype(np.float32)); hop=1000
    return np.array([a[i*hop:(i+1)*hop].mean() if (i+1)*hop<=len(a) else 0.0 for i in range(n)])
def norm(x):
    s=x.std(); return (x-x.mean())/(s+1e-6)
def window_lags(m,e,half=30,step=24):
    anchors=[]
    for c in range(half,len(m)-half,step):
        mw=norm(m[c-half:c+half])
        if e[max(0,c-half):c+half].max()<e.max()*0.08: continue  # silence
        best,bl=-9,None
        for lag in range(-6,31):  # some takes stretch a phrase by up to ~1.2s
            lo,hi=c-half-lag,c+half-lag
            if lo<0 or hi>len(e): continue
            cc=(mw*norm(e[lo:hi])).mean()
            if cc>best: best,bl=cc,lag
        if bl is not None and best>0.2: anchors.append((c,bl,best))
    return anchors
def warp(key, src=None):
    stream=f'media/dealers/vera/runtime/indexed/streams/idle-1_speak_{key}.h264'
    cur=f'media/dealers/vera/runtime/indexed/audio/en/{key}.mp3'
    orig=f'media/dealers/vera/runtime/indexed/audio/en/orig/{key}.mp3'
    if not (os.path.exists(stream) and os.path.exists(cur)): return f'{key}: missing assets, skipped'
    if not os.path.exists(orig): shutil.copy(cur,orig)
    if src is None: src=orig
    m=mouth_track(stream); e=audio_env(src,len(m)+48)
    anchors=window_lags(m,e)
    if len(anchors)<3:
        shutil.copy(src,cur); return f'{key}: only {len(anchors)} anchors, left unwarped'
    # audio time tau_i = c - lag maps to video time v_i = c
    pts=[]
    for c,lag,_ in anchors:
        tau,v=(c-lag)/FPS,c/FPS
        if pts and (tau<=pts[-1][0]+0.15 or v<=pts[-1][1]+0.15): continue  # keep monotonic
        pts.append((tau,v))
    if len(pts)<2: shutil.copy(src,cur); return f'{key}: map degenerate, left unwarped'
    # head: play [0,tau0] ending at v0 -> delay by v0-tau0 (clamp >=0)
    segs=[]; head_delay=max(0.0,pts[0][1]-pts[0][0])
    cuts=[0.0]+[p[0] for p in pts]
    vtimes=[head_delay]+[p[1] for p in pts]
    adur=None
    for i in range(len(cuts)-1):
        sd=cuts[i+1]-cuts[i]; vd=vtimes[i+1]-vtimes[i]
        if sd<=0.05 or vd<=0.05: continue
        tempo=min(1.35,max(0.75,sd/vd))
        segs.append((cuts[i],cuts[i+1],tempo))
    segs.append((cuts[-1],None,1.0))  # tail unwarped
    parts=[];flt=[]
    for i,(a,b,t) in enumerate(segs):
        trim=f'atrim=start={a:.3f}'+(f':end={b:.3f}' if b else '')
        flt.append(f'[0:a]{trim},asetpts=PTS-STARTPTS,atempo={t:.4f}[s{i}]')
        parts.append(f'[s{i}]')
    fc=';'.join(flt)+f";{''.join(parts)}concat=n={len(segs)}:v=0:a=1"
    if head_delay>0.02: fc+=f',adelay={int(head_delay*1000)}:all=1'
    fc+='[out]'
    r=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',src,'-filter_complex',fc,
        '-map','[out]','-codec:a','libmp3lame','-q:a','3','-y',cur],capture_output=True,text=True)
    if r.returncode!=0: shutil.copy(src,cur); return f'{key}: ffmpeg failed, left unwarped'
    lags=[f'{int(l*1000/FPS):+d}' for _,l,_ in anchors]
    return f'{key}: warped, {len(segs)} segments, head +{int(head_delay*1000)}ms, lag curve ms [{" ".join(lags)}]'
def residual_ms(key):
    stream=f'media/dealers/vera/runtime/indexed/streams/idle-1_speak_{key}.h264'
    cur=f'media/dealers/vera/runtime/indexed/audio/en/{key}.mp3'
    m=mouth_track(stream); e=audio_env(cur,len(m)+48)
    a=window_lags(m,e)
    if not a: return None
    return int(np.median([l for _,l,_ in a])*1000/FPS)
def iterate(key, passes=3):
    msg=warp(key)
    if 'warped' not in msg: return msg
    import tempfile
    for i in range(passes-1):
        r=residual_ms(key)
        if r is None or abs(r)<=100: return msg+f' | residual {r}ms after pass {i+1}'
        tmp=tempfile.mktemp(suffix='.mp3'); shutil.copy(f'media/dealers/vera/runtime/indexed/audio/en/{key}.mp3',tmp)
        msg=warp(key,src=tmp); os.unlink(tmp)
        if 'warped' not in msg: return msg
    return msg+f' | residual {residual_ms(key)}ms final'
if __name__=='__main__':
    for key in sys.argv[1:]: print(iterate(key))
