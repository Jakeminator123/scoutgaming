#!/usr/bin/env python3
# Stamp measured audioDelayMs into index.json for every speak clip that has
# an audio line. The engine delays that clip's voice by this amount; the CSS
# --lipsync-offset remains the fallback for unmeasured clips.
import json, os, subprocess, sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'media/dealers/vera/runtime/indexed'
IDX=f'{BASE}/streams/index.json'
idx=json.load(open(IDX))
# hand-verified delays (contact-sheet mouth onset vs waveform word onset)
# beat every automatic method on short clips; they win outright
# hand-tuned overrides are per-dealer: the repo file belongs to Vera's set
ov_path='pipeline/lipsync-overrides.json' if BASE=='media/dealers/vera/runtime/indexed' else f'{BASE}/lipsync-overrides.json'
try: OVERRIDES=json.load(open(ov_path))
except FileNotFoundError: OVERRIDES={}
changed=0
for key,c in idx['clips'].items():
    if '/speak/' not in key: continue
    short=key.split('/')[-1]
    if short in OVERRIDES:
        c['audioDelayMs']=OVERRIDES[short]; changed+=1
        print(f"{key}: audioDelayMs={c['audioDelayMs']} (manual override)"); continue
    mp3=f"{BASE}/audio/en/{short}.mp3"
    if not os.path.exists(mp3): continue
    out=subprocess.run(['python3','pipeline/measure-lipsync.py',f"{BASE}/streams/{c['file']}",mp3],capture_output=True,text=True)
    r=json.loads(out.stdout)
    # short lines give the correlation too little signal - for those, match
    # the FIRST SUSTAINED mouth motion against the audio onset instead
    if c.get('frameCount',999)<150 or r['corr']<0.3:
        o=subprocess.run(['python3','pipeline/measure-onset.py',f"{BASE}/streams/{c['file']}",mp3],capture_output=True,text=True)
        r2=json.loads(o.stdout)
        if r2['ok']:
            c['audioDelayMs']=max(0,r2['lagMs']); changed+=1
            print(f"{key}: audioDelayMs={c['audioDelayMs']} (onset method)"); continue
    if r['corr']<0.15: print(f"{key}: weak corr {r['corr']}, skipping"); continue
    c['audioDelayMs']=max(0,r['lagMs']); changed+=1
    print(f"{key}: audioDelayMs={c['audioDelayMs']} (corr {r['corr']})")
json.dump(idx,open(IDX,'w'))
print(f"stamped {changed} clips")
