#!/usr/bin/env python3
# Export live-game keyframes: for every speak clip of a dealer, the gate's own
# measurements (mouth waves in video time, audio phrases in audio time, the
# shipped audioDelayMs, a 10ms audio envelope) plus the dealer's mouth box.
# The game's ?kf=1 overlay draws these on the live table while she speaks.
# Usage: export-kf.py <base>
import json, os, sys, subprocess
import numpy as np
base=sys.argv[1]
code=open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'pipeline/auto-phrase-warp.py')).read().replace("if __name__=='__main__': main()","")
W={}; exec(compile(code,'warp','exec'),W)
cfg=json.load(open(f'{base}/trackcfg.json')) if os.path.exists(f'{base}/trackcfg.json') else {'crop':[560,340,340,360],'nose':[120,70,80,70],'mouthOff':[-30,60,140,90]}
cx,cy,cw,ch=cfg['crop']; nx,ny,nw,nh=cfg['nose']; dx,dy,mw,mh=cfg['mouthOff']
idx=json.load(open(f'{base}/streams/index.json'))
out={'mouthRect':[cx+nx+dx,cy+ny+dy,mw,mh],'noseRect':[cx+nx,cy+ny,nw,nh],'clips':{}}
for key,c in idx['clips'].items():
    if '/speak/' not in key: continue
    k=key.split('/')[-1]
    mp3=f'{base}/audio/en/dry/{k}.mp3'
    if not os.path.exists(mp3): mp3=f'{base}/audio/en/{k}.mp3'
    if not os.path.exists(mp3): continue
    try:
        aph,waves,_=W['analyze'](f"{base}/streams/{c['file']}",mp3,(660,480),None,cfg)
        waves=[w for w in waves if w[1]-w[0]>180] or waves
    except Exception as e:
        print(f'{k}: measure failed {e}'); continue
    a=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',mp3,'-f','f32le','-ac','1','-ar','44100','-'],capture_output=True).stdout
    x=np.abs(np.frombuffer(a,dtype=np.float32)); hop=441
    env=np.array([x[j*hop:(j+1)*hop].mean() for j in range(len(x)//hop)])
    env=(env/(env.max()+1e-9)).round(3)
    out['clips'][k]={'delayMs':c.get('audioDelayMs',0),
        'waves':[{'id':f'wave-{i+1:02d}','startMs':int(a0),'endMs':int(a1)} for i,(a0,a1) in enumerate(waves)],
        'phrases':[{'id':f'ph-{i+1:02d}','startMs':int(a0),'endMs':int(a1)} for i,(a0,a1) in enumerate(aph)],
        'env10ms':[float(v) for v in env]}
    print(f'{k}: {len(out["clips"][k]["waves"])} waves, {len(out["clips"][k]["phrases"])} phrases, delay {out["clips"][k]["delayMs"]}')
json.dump(out,open(f'{base}/streams/kf.json','w'))
print(f'-> {base}/streams/kf.json ({len(out["clips"])} clips)')
