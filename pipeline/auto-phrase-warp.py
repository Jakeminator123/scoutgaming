#!/usr/bin/env python3
# The generation-time sync stage: every generated speech clip gets its audio
# phrase-aligned to the mouth BEFORE it ships. Encodes the manual contact-sheet
# procedure: group audio speech into phrases, group mouth activity into waves,
# and when they correspond one-to-one, time-map the audio onto the mouth.
# Falls back to a constant measured offset when the structures don't match.
# Usage: auto-phrase-warp.py <base-dir> [--apply] [--crop X:Y] [keys...]
import subprocess, io, sys, os, json, shutil
import numpy as np
from PIL import Image
FPS=24
def mouth_track(stream, cx=660, cy=480):
    out=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-f','h264','-i',stream,
        '-vf',f'crop=200:140:{cx}:{cy},scale=50:35','-vsync','0','-f','image2pipe','-vcodec','png','-'],
        capture_output=True).stdout
    sig=b'\x89PNG'; st=[i for i in range(len(out)) if out[i:i+4]==sig]
    fr=[np.array(Image.open(io.BytesIO(out[s:(st[i+1] if i+1<len(st) else len(out))])).convert('L'),dtype=np.float32) for i,s in enumerate(st)]
    return np.array([0.0]+[np.abs(fr[i]-fr[i-1]).mean() for i in range(1,len(fr))])
def audio_env_ms(mp3, hop_ms=10):
    out=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',mp3,'-f','s16le','-ac','1','-ar','24000','-'],capture_output=True).stdout
    a=np.abs(np.frombuffer(out,dtype=np.int16).astype(np.float32)); hop=int(24000*hop_ms/1000)
    return np.array([a[i*hop:(i+1)*hop].mean() for i in range(len(a)//hop)]), len(a)/24000*1000
def bursts(x, thr, hop_ms, min_ms):
    on=x>thr; runs=[]; s0=None
    for i,v in enumerate(on):
        if v and s0 is None: s0=i
        if not v and s0 is not None:
            if (i-s0)*hop_ms>=min_ms: runs.append([s0*hop_ms,i*hop_ms])
            s0=None
    if s0 is not None: runs.append([s0*hop_ms,len(on)*hop_ms])
    return runs
def group(runs, gap_ms):
    if not runs: return []
    out=[list(runs[0])]
    for a,b in runs[1:]:
        if a-out[-1][1]<=gap_ms: out[-1][1]=b
        else: out.append([a,b])
    return out
def analyze(stream, mp3, crop):
    m=mouth_track(stream,*crop)
    env,adur=audio_env_ms(mp3)
    aph=group(bursts(env,np.percentile(env,97)*0.15,10,60),300)
    mth=max(3.0,np.percentile(m,60))
    waves=group(bursts(m,mth,1000/FPS,120),330)
    return aph, waves, adur
def reconcile(aph, waves):
    # her mouth keeps moving after the last word (settling, a smile) and can
    # split one phrase across a micro-pause - reconcile counts conservatively
    w=[list(x) for x in waves]
    while len(w)>len(aph) and len(w)>1:
        # prefer dropping a trailing wave; else merge the closest pair
        gaps=[w[i+1][0]-w[i][1] for i in range(len(w)-1)]
        if len(w)==len(aph)+1 and gaps and gaps[-1]==max(gaps):
            w.pop()
        else:
            i=gaps.index(min(gaps)); w[i][1]=w[i+1][1]; w.pop(i+1)
    return w
def plan(aph, waves):
    if not aph or len(aph)!=len(waves): return None
    segs=[]; cuts=[0.0]; vt=[None]
    # head: silence before first phrase must end at first wave start
    delay=max(0.0, waves[0][0]-aph[0][0])
    prev_a, prev_v = 0.0, delay
    for (a0,a1),(v0,v1) in zip(aph,waves):
        # gap before this phrase: silence may stretch or squeeze freely
        if a0>prev_a+20:
            gd_a=a0-prev_a; gd_v=max(40.0, v0-prev_v)
            gt=max(0.26,min(4.0,gd_a/gd_v))
            if gt<0.5:   # atempo floor is 0.5: split the silence into halves
                mid=(prev_a+a0)/2; h=gt**0.5
                segs.append((prev_a,mid,h)); segs.append((mid,a0,h))
            else:
                segs.append((prev_a,a0,gt))
        # speech itself must stay essentially untouched - re-paced speech
        # reads as dubbing even when the onsets line up
        pd_a=a1-a0; pd_v=max(120.0, v1-v0)
        t=pd_a/pd_v
        if not (0.88<=t<=1.15): return None   # bad draw: reroll, don't re-pace
        segs.append((a0,a1,t))
        prev_a, prev_v = a1, v1
    segs.append((prev_a,None,1.0))
    return segs, delay
def render(src, dst, segs, delay):
    flt=[];parts=[]
    for i,(a,b,t) in enumerate(segs):
        trim=f'atrim=start={a/1000:.3f}'+(f':end={b/1000:.3f}' if b else '')
        flt.append(f'[0:a]{trim},asetpts=PTS-STARTPTS,atempo={t:.4f}[s{i}]')
        parts.append(f'[s{i}]')
    fc=';'.join(flt)+f";{''.join(parts)}concat=n={len(segs)}:v=0:a=1"
    if delay>20: fc+=f',adelay={int(delay)}:all=1'
    fc+='[out]'
    r=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',src,'-filter_complex',fc,
        '-map','[out]','-codec:a','libmp3lame','-q:a','3','-y',dst],capture_output=True,text=True)
    return r.returncode==0
def phrase_errors(aph, waves):
    return [round(v[0]-a[0]) for a,v in zip(aph,waves)]
def main():
    args=[a for a in sys.argv[1:] if not a.startswith('--')]
    base=args[0]; keys=args[1:]
    apply='--apply' in sys.argv
    crop=(660,480)
    for a in sys.argv:
        if a.startswith('--crop'): crop=tuple(int(x) for x in a.split('=')[1].split(':'))
    idx=json.load(open(f'{base}/streams/index.json'))
    if not keys: keys=[k.split('/')[-1] for k in idx['clips'] if '/speak/' in k]
    for key in keys:
        c=idx['clips'].get(f'idle-1/speak/{key}')
        mp3=f'{base}/audio/en/{key}.mp3'
        if not c or not os.path.exists(mp3): continue
        stream=f"{base}/streams/{c['file']}"
        try: tuned=json.load(open(f'{base}/lipsync-overrides.json'))
        except FileNotFoundError: tuned={}
        if key in tuned and os.path.exists(f'{base}/audio/en/orig/{key}.mp3'):
            print(f'{key}: already hand-tuned, skipping'); continue
        aph,waves,adur=analyze(stream,mp3,crop)
        waves=reconcile(aph,waves)
        errs=phrase_errors(aph,waves)
        status=f"{key}: phrases={len(aph)} waves={len(waves)} onset-errors={errs}"
        ok = aph and len(aph)==len(waves) and all(abs(e)<=120 for e in errs)
        if ok: print(status+" ALIGNED"); continue
        p=plan(aph,waves)
        if p is None:
            print(status+" STRUCTURE MISMATCH -> constant-offset stamp only"); continue
        if not apply:
            print(status+" -> would warp"); continue
        orig=f'{base}/audio/en/orig/{key}.mp3'
        os.makedirs(os.path.dirname(orig),exist_ok=True)
        if not os.path.exists(orig): shutil.copy(mp3,orig)
        if render(orig,mp3,*p):
            a2,w2,_=analyze(stream,mp3,crop)
            e2=phrase_errors(a2,w2) if len(a2)==len(w2) else ['?']
            print(status+f" -> WARPED, residual onset-errors={e2}")
            ovp=f'{base}/lipsync-overrides.json'
            try: ov=json.load(open(ovp))
            except FileNotFoundError: ov={}
            ov[key]=0; json.dump(ov,open(ovp,'w'),indent=1)
        else:
            shutil.copy(orig,mp3); print(status+" -> ffmpeg failed, reverted")
if __name__=='__main__': main()
