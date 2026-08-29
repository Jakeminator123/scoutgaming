#!/usr/bin/env python3
# One-shot rescue driver: measure the PRISTINE stream (orig bak if present),
# pair mouth waves to audio phrases, compute the piecewise retime map, render,
# remerge the frames table, stamp the measured onset, and re-verify.
# Bars: speedup <= 2.05, slowdown (stretch) <= 1.40 - outside -> SKIP (regen).
# Usage: auto-rescue.py <base> <key> [--squeeze gs:ge[,gs:ge...]] (squeezes are
# applied to audio/en/<key>.mp3 with an orig/ backup BEFORE mapping)
import json, os, sys, shutil, subprocess, tempfile
import importlib.util
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
code=open(f'{ROOT}/pipeline/auto-phrase-warp.py').read().replace("if __name__=='__main__': main()","")
W={}; exec(compile(code,'warp','exec'),W)
base,key=sys.argv[1],sys.argv[2]
squeezes=[]
for i,a in enumerate(sys.argv):
    if a=='--squeeze': squeezes=[tuple(int(x) for x in p.split(':')) for p in sys.argv[i+1].split(',')]
cfg=json.load(open(f'{base}/trackcfg.json'))
idxp=f'{base}/streams/index.json'
idx=json.load(open(idxp)); c=idx['clips'][f'idle-1/speak/{key}']
stream=f"{base}/streams/{c['file']}"
os.makedirs(f'{base}/streams/orig',exist_ok=True)
bak=f"{base}/streams/orig/{c['file']}"
if not os.path.exists(bak): shutil.copy(stream,bak)
mp3=f'{base}/audio/en/{key}.mp3'
if squeezes:
    od=f'{base}/audio/en/orig'; os.makedirs(od,exist_ok=True)
    ab=f'{od}/{key}.mp3'
    if not os.path.exists(ab): shutil.copy(mp3,ab)
    src=ab; segs=[]; prev=0.0; flt=[]; parts=[]
    for gs,ge in squeezes:
        segs.append((prev,gs,1.0)); segs.append((gs,ge,(ge-gs)/120.0)); prev=ge
    segs.append((prev,None,1.0))
    for i,(a,b,t) in enumerate(segs):
        tr=f'atrim=start={a/1000:.3f}'+(f':end={b/1000:.3f}' if b else '')
        flt.append(f'[0:a]{tr},asetpts=PTS-STARTPTS'+(f',atempo={t:.3f}' if abs(t-1)>0.01 else '')+f'[s{i}]')
        parts.append(f'[s{i}]')
    fc=';'.join(flt)+f";{''.join(parts)}concat=n={len(segs)}:v=0:a=1[out]"
    subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',src,'-filter_complex',fc,
        '-map','[out]','-codec:a','libmp3lame','-q:a','3','-y',mp3],check=True)
def measure(st):
    aph,waves,_=W['analyze'](st,mp3,(660,480),None,cfg)
    waves=[w for w in waves if w[1]-w[0]>180] or waves
    return aph,waves
aph,waves=measure(bak)
# merge adjacent waves (gap<450ms) until counts match phrases
wv=[list(w) for w in waves]
while len(wv)>len(aph):
    gaps=[wv[i+1][0]-wv[i][1] for i in range(len(wv)-1)]
    i=gaps.index(min(gaps))
    if min(gaps)>450 and len(wv)==len(aph)+1: wv.pop(); continue
    wv[i][1]=wv[i+1][1]; wv.pop(i+1)
if len(wv)<len(aph):  # one wave carries several phrases: single span map
    wv=[[wv[0][0],wv[-1][1]]]; aph=[(aph[0][0],aph[-1][1])]
pairs=[]; ok=True
for (a0,a1),(v0,v1) in zip(aph,wv):
    sp=(v1-v0)/max(1,(a1-a0))
    if sp>2.05 or sp<1/1.40: ok=False
    pairs.append([round(v0),round(v1),round(a0),round(a1)])
if not ok:
    print(json.dumps({'key':key,'verdict':'SKIP-REGEN','pairs':pairs})); sys.exit(0)
shutil.copy(bak,stream)
r=subprocess.run(['python3',f'{ROOT}/pipeline/retime-video-map.py',base,key,json.dumps(pairs)],capture_output=True,text=True)
if r.returncode!=0: print('retime fail',r.stderr[-300:]); sys.exit(1)
td=tempfile.mkdtemp(); os.makedirs(f'{td}/in'); shutil.copy(stream,f'{td}/in/')
subprocess.run(['node',f'{ROOT}/pipeline/build-index.mjs',f'{td}/in',f'{td}/out'],capture_output=True,check=True)
tmp=json.load(open(f'{td}/out/streams/index.json'))
nc=tmp['clips'][f'idle-1/speak/{key}']
idx=json.load(open(idxp)); c=idx['clips'][f'idle-1/speak/{key}']
c['frameCount']=nc['frameCount']; c['frames']=nc['frames']
shutil.rmtree(td)
aph2,w2=measure(stream)
onset=round(w2[0][0]-aph2[0][0]) if w2 and aph2 else 0
c['audioDelayMs']=max(0,onset)
json.dump(idx,open(idxp,'w'))
try: ov=json.load(open(f'{base}/lipsync-overrides.json'))
except FileNotFoundError: ov={}
ov[key]=max(0,onset); json.dump(ov,open(f'{base}/lipsync-overrides.json','w'),indent=1)
a0,a1=aph2[0][0],aph2[-1][1]; v0,v1=w2[0][0],w2[-1][1]
tempo=round((a1-a0)/max(120,(v1-v0)),2)
print(json.dumps({'key':key,'verdict':'DONE','stamp':max(0,onset),'tempo':tempo,'pairs':pairs}))
