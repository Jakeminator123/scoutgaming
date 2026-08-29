#!/usr/bin/env python3
# Stage 2 of the viseme rig: harvest a dealer's mouth-tile atlas from her own
# gate-passed speech footage. Tracks every frame (nose NCC anchor), measures
# mouth metrics, classifies frames into viseme classes, picks the sharpest
# exemplars, and writes tiles + an atlas contact sheet.
# Classes: MM closed lips | AA open jaw | OH rounded | EE spread/teeth | FF lip-under-teeth
# Usage: harvest-visemes.py <base> <out-dir> [clipKey ...]
import json, os, sys, subprocess, io
import numpy as np, cv2
from PIL import Image
FPS=24
base,outd=sys.argv[1],sys.argv[2]
keys=sys.argv[3:]
os.makedirs(f'{outd}/tiles',exist_ok=True)
dealer=os.path.basename(base.rstrip('/')) if 'dealers' in base else 'vera'
cfg=json.load(open(f'{base}/trackcfg.json')) if os.path.exists(f'{base}/trackcfg.json') else {'crop':[560,340,340,360],'nose':[120,70,80,70],'mouthOff':[-30,60,140,90]}
cx,cy,cw,ch=cfg['crop']; nx,ny,nw,nh=cfg['nose']; dx,dy,mw,mh=cfg['mouthOff']
# tile = mouth box grown by margin for blending context
MX,MY=48,36
idx=json.load(open(f'{base}/streams/index.json'))
if not keys: keys=[k.split('/')[-1] for k in idx['clips'] if '/speak/' in k]
cands=[]
for key in keys:
    c=idx['clips'].get(f'idle-1/speak/{key}')
    if not c: continue
    out=subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-f','h264','-r',str(FPS),'-i',f"{base}/streams/{c['file']}",
        '-vf',f'crop={cw}:{ch}:{cx}:{cy}','-vsync','0','-f','image2pipe','-vcodec','png','-'],capture_output=True).stdout
    sig=b'\x89PNG'; st=[i for i in range(len(out)) if out[i:i+4]==sig]
    frames=[np.array(Image.open(io.BytesIO(out[s:(st[i+1] if i+1<len(st) else len(out))])).convert('RGB')) for i,s in enumerate(st)]
    gray=[cv2.cvtColor(f,cv2.COLOR_RGB2GRAY).astype(np.float32) for f in gray] if False else [cv2.cvtColor(f,cv2.COLOR_RGB2GRAY).astype(np.float32) for f in frames]
    tpl=gray[0][ny:ny+nh,nx:nx+nw].copy()
    R=30; pos=(nx,ny)
    for fi,g in enumerate(gray):
        px,py=pos
        y0=max(0,py-R); y1=min(ch-nh,py+R); x0=max(0,px-R); x1=min(cw-nw,px+R)
        res=cv2.matchTemplate(g[y0:y1+nh,x0:x1+nw],tpl,cv2.TM_CCOEFF_NORMED)
        _,mv,_,ml=cv2.minMaxLoc(res)
        pos=(x0+ml[0],y0+ml[1])
        if mv<0.5: continue                      # lost track: unusable frame
        mx0=pos[0]+dx; my0=pos[1]+dy
        if mx0-MX<0 or my0-MY<0 or mx0+mw+MX>cw or my0+mh+MY>ch: continue
        patch=g[my0:my0+mh,mx0:mx0+mw]
        core=patch[int(mh*.20):int(mh*.85), int(mw*.22):int(mw*.78)]
        openness=float((core<60).mean()); teeth=float((core>150).mean())
        dk=(core<60)
        dcols=np.where(dk.any(axis=0))[0]; drows=np.where(dk.any(axis=1))[0]
        dw=float((dcols[-1]-dcols[0])/core.shape[1]) if len(dcols)>1 else 0.0
        dh=float((drows[-1]-drows[0])/core.shape[0]) if len(drows)>1 else 0.0
        width=dw   # cavity width fraction (round O = narrow, spread = wide)
        sharp=float(cv2.Laplacian(patch,cv2.CV_32F).var())
        tile=frames[fi][my0-MY:my0+mh+MY, mx0-MX:mx0+mw+MX]
        cands.append({'key':key,'frame':fi,'open':openness,'teeth':teeth,'width':width,'dh':dh,'sharp':sharp,
                      'tile':tile,'anchor':[int(pos[0]),int(pos[1])]})
print(f'{dealer}: {len(cands)} tracked mouth frames from {len(keys)} clips')
# adaptive per-dealer thresholds: her own footage defines closed/open, not
# absolute numbers (lighting and lip tone shift the scales per dealer)
op=np.array([c['open'] for c in cands]); te=np.array([c['teeth'] for c in cands])
o_lo,o_mid,o_hi=np.percentile(op,[15,55,85]); t_hi=np.percentile(te,75)
def classify(c):
    if c['open']<=o_lo and c['teeth']<t_hi/2: return 'MM'        # sealed lips (P/B/M)
    if c['open']>o_mid and 0.0<c['width']<=0.45: return 'OH'     # tall narrow cavity (O/U/W)
    if c['teeth']>=t_hi and c['open']<o_mid: return 'EE'         # teeth, little jaw
    if c['open']>=o_hi and c['width']>0.45: return 'AA'          # open jaw, wide
    if o_mid<=c['open']<o_hi: return 'AH'                        # mid open
    return None
byclass={}
for c in cands:
    cl=classify(c)
    if cl: byclass.setdefault(cl,[]).append(c)
atlas={}
for cl,arr in sorted(byclass.items()):
    arr.sort(key=lambda c:-c['sharp'])
    picks=arr[:3]
    atlas[cl]=[]
    for i,c in enumerate(picks):
        fn=f'{dealer}-{cl}-{i}.png'
        Image.fromarray(c['tile']).save(f'{outd}/tiles/{fn}')
        atlas[cl].append({'file':fn,'from':f"{c['key']}#f{c['frame']}",'open':round(c['open'],4),'teeth':round(c['teeth'],4)})
    print(f'{cl}: {len(arr)} candidates, kept {len(picks)}')
json.dump({'dealer':dealer,'tileW':mw+2*MX,'tileH':mh+2*MY,'margin':[MX,MY],'classes':atlas},
          open(f'{outd}/{dealer}-atlas.json','w'),indent=1)
# contact sheet
cols=max(len(v) for v in atlas.values()) if atlas else 1
tw,th=mw+2*MX,mh+2*MY
sheet=Image.new('RGB',(40+cols*(tw+8),30+len(atlas)*(th+26)),(12,13,16))
from PIL import ImageDraw
d=ImageDraw.Draw(sheet)
for r,(cl,arr) in enumerate(sorted(atlas.items())):
    d.text((6,34+r*(th+26)+th//2),cl,fill=(214,255,58))
    for i,t in enumerate(arr):
        im=Image.open(f'{outd}/tiles/{t["file"]}')
        sheet.paste(im,(40+i*(tw+8),30+r*(th+26)))
        d.text((40+i*(tw+8),30+r*(th+26)+th+2),t['from'][:26],fill=(140,150,160))
sheet.save(f'{outd}/{dealer}-atlas-sheet.png')
print(f'atlas -> {outd}/{dealer}-atlas.json')
