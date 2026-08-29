#!/usr/bin/env python3
# Stage 3: text + TTS audio -> viseme keyframe timeline, every keyframe and
# audio wave-segment carries an ID and the binding maps wave-id -> keyframe-ids.
# Phonemes come from a small built-in G2P for the casino vocabulary; timing is
# distributed inside the MEASURED audio bursts (vowels weigh 2, consonants 1),
# so /m/ /b/ /p/ land as real lip seals instead of amplitude flaps.
# Usage: viseme-timeline.py <audio.mp3> "<text>" <out.json>
import json, sys, subprocess
import numpy as np
SR=44100
G2P={  # word -> viseme sequence (MM sealed, EE spread/teeth, AA open, AH mid, OH round)
 'this':['EE'],'table':['EE','AA','MM','AH','EE'],'pays':['MM','AA','EE'],
 'three':['EE','OH','EE'],'to':['EE','OH'],'two':['EE','OH'],'and':['AA','EE'],
 'i':['AA'],'never':['EE','AA','MM','OH'],'miss':['MM','EE','EE'],'a':['AH'],
 'beat':['MM','EE','EE'],'bets':['MM','AA','EE'],'are':['AA','OH'],'closed':['EE','OH','EE'],
 'good':['EE','OH','EE'],'luck':['EE','AH','EE'],'welcome':['OH','AA','EE','AH','MM'],
 'the':['EE','AH'],'house':['AH','OH','EE'],'takes':['EE','AA','EE'],'one':['OH','AH','EE'],
 'well':['OH','AA','EE'],'played':['MM','EE','AA','EE'],'enjoy':['AA','EE','OH','EE'],
 'it':['EE'],'place':['MM','EE','AA','EE'],'your':['EE','OH'],'blackjack':['MM','EE','AA','EE','AA','EE'],
 'dealer':['EE','AH','EE'],'busts':['MM','AH','EE','EE'],'insurance':['EE','EE','OH','AH','EE'],
}
VOWELS={'AA','AH','OH'}
mp3,text,outp=sys.argv[1],sys.argv[2],sys.argv[3]
a=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',mp3,'-f','f32le','-ac','1','-ar',str(SR),'-'],capture_output=True).stdout
x=np.abs(np.frombuffer(a,dtype=np.float32))
hop=SR//100  # 10ms
env=np.array([x[i*hop:(i+1)*hop].mean() for i in range(len(x)//hop)])
thr=np.percentile(env,97)*0.15
on=env>thr
runs=[]; s0=None
for i,v in enumerate(on):
    if v and s0 is None: s0=i
    if not v and s0 is not None:
        if (i-s0)*10>=60: runs.append([s0*10,i*10])
        s0=None
if s0 is not None: runs.append([s0*10,len(on)*10])
merged=[list(runs[0])] if runs else []
for r in runs[1:]:
    if r[0]-merged[-1][1]<=200: merged[-1][1]=r[1]
    else: merged.append(list(r))
waves=[{'id':f'wav-{i+1:02d}','startMs':int(a0),'endMs':int(a1)} for i,(a0,a1) in enumerate(merged)]
# phoneme plan for the whole line
words=[w.strip('.,!?').lower() for w in text.split() if w.strip('.,!?')]
plan=[]
for w in words:
    vs=G2P.get(w)
    if not vs:  # fallback: alternate EE/AH by length
        vs=['EE' if i%2==0 else 'AH' for i in range(max(2,len(w)//2))]
    plan.append((w,vs))
# SYLLABLE-LEVEL compression: one keyframe per vowel nucleus, keep lip seals
# (MM) - a keyframe per phoneme reads as a too-fast flipbook (Kevin 08-29)
syll=[]
for w,vs in plan:
    run=[]
    for v in vs:
        if v=='MM':
            if run: syll.append((w,max(run,key=lambda x:(x in VOWELS)))); run=[]
            syll.append((w,'MM'))
        elif v in VOWELS:
            run.append(v)
        else:
            if not run: run.append(v)   # leading consonant colors the onset
    if run: syll.append((w,max(run,key=lambda x:(x in VOWELS))))
# ENERGY-GUIDED timing: vowels land on envelope peaks, seals in valleys
import scipy.signal as ss
sm=np.convolve(env,np.ones(5)/5,mode='same')
peaks=[]
for wv in ( [ (w['startMs'],w['endMs']) for w in waves ] ):
    a,b=wv[0]//10,wv[1]//10
    pk,_=ss.find_peaks(sm[a:b],distance=14,prominence=sm.max()*0.06)
    peaks+= [ (p+a)*10 for p in pk ]
peaks.sort()
vidx=[i for i,(w,v) in enumerate(syll) if v in VOWELS]
kfs=[]; binding={}; kid=0
times={}
if len(peaks)>=2 and vidx:
    # map vowel nuclei onto peaks in order (interpolate when counts differ)
    for j,i in enumerate(vidx):
        pj=min(int(round(j*(len(peaks)-1)/max(1,len(vidx)-1))),len(peaks)-1)
        times[i]=peaks[pj]
span0=waves[0]['startMs'] if waves else 0
span1=waves[-1]['endMs'] if waves else 1000
def wave_of(t):
    for w in waves:
        if w['startMs']-60<=t<=w['endMs']+60: return w
    return waves[0]
# assign times: vowels at their peaks, others midway between neighbors
last=span0
for i,(w,v) in enumerate(syll):
    if i in times: t=times[i]
    else:
        nxt=next((times[j] for j in sorted(times) if j>i), span1)
        t=(last+nxt)/2
    dur=140 if v in VOWELS else 80
    t0=max(span0,t-dur//2); t1=min(span1,t0+dur)
    if kfs and t0<kfs[-1]['endMs']: t0=kfs[-1]['endMs']; t1=max(t1,t0+50)
    wv=wave_of(t0); kid+=1
    kf={'id':f'kf-{kid:03d}','viseme':v,'startMs':int(t0),'endMs':int(t1),'word':w,'wave':wv['id'],
        'intensity':round(float(env[min(len(env)-1,int(t0/10))]/(env.max()+1e-9)),2)}
    kfs.append(kf); binding.setdefault(wv['id'],[]).append(kf['id'])
    last=t1
# stretch each keyframe to meet the next (continuous coverage inside waves)
for i in range(len(kfs)-1):
    gap=kfs[i+1]['startMs']-kfs[i]['endMs']
    if 0<gap<=260: kfs[i]['endMs']=kfs[i+1]['startMs']
json.dump({'text':text,'audio':mp3.split('/')[-1],'waves':waves,'keyframes':kfs,'binding':binding},
          open(outp,'w'),indent=1)
print(json.dumps({'waves':len(waves),'keyframes':len(kfs),'span':[waves[0]['startMs'],waves[-1]['endMs']] if waves else None}))
