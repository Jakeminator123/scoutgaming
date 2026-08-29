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
total_units=sum((2 if v in VOWELS else 1) for _,vs in plan for v in vs)
span=sum(w['endMs']-w['startMs'] for w in waves)
unit=span/max(1,total_units)
kfs=[]; binding={}
cursor_wave=0; t=waves[0]['startMs'] if waves else 0
kid=0
for w,vs in plan:
    for v in vs:
        dur=unit*(2 if v in VOWELS else 1)
        wv=waves[cursor_wave]
        if t+dur>wv['endMs']+40 and cursor_wave+1<len(waves):
            cursor_wave+=1; wv=waves[cursor_wave]; t=wv['startMs']
        kid+=1
        kf={'id':f'kf-{kid:03d}','viseme':v,'startMs':int(t),'endMs':int(t+dur),'word':w,'wave':wv['id'],
            'intensity':round(float(env[min(len(env)-1,int(t/10))]/(env.max()+1e-9)),2)}
        kfs.append(kf); binding.setdefault(wv['id'],[]).append(kf['id'])
        t+=dur
json.dump({'text':text,'audio':mp3.split('/')[-1],'waves':waves,'keyframes':kfs,'binding':binding},
          open(outp,'w'),indent=1)
print(json.dumps({'waves':len(waves),'keyframes':len(kfs),'span':[waves[0]['startMs'],waves[-1]['endMs']] if waves else None}))
