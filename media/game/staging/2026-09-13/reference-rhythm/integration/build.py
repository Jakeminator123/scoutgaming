"""Stage continuous shoe-return takes. Tracking is explicitly a hand proxy.
Original footage, Vision observations and original person masks are preserved.
"""
from pathlib import Path
import json, hashlib, subprocess
import numpy as np
from PIL import Image, ImageFilter

ROOT=Path(__file__).resolve().parent
PUBLIC=ROOT.parents[4]/'web/public'
OUT=PUBLIC/'dealers/astrid/performance/rhythm'
OUT.mkdir(parents=True,exist_ok=True)
hands=json.loads((ROOT/'hands.json').read_text())
W,H=1280,720
sx,sy=1132/832,848/624
def point(p): return [(p[0]*832*sx+74)/W,(p[1]*624*sy-112)/H]
def registered(im):
    im=im.resize((1132,848),Image.Resampling.LANCZOS)
    out=Image.new(im.mode,(W,H));out.paste(im,(74,-112));return out
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()

tracks=[]
for i in range(48):
    rgb=np.array(Image.open(ROOT/'frames'/f'{i+1:04}.png').convert('RGB')).astype(float)
    matte=np.array(Image.open(ROOT/'person'/f'{i+1:04}.png').convert('L')).astype(float)
    r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
    yy,xx=np.indices(matte.shape)
    skin=(r>65)&(r-g>12)&(g-b>6)&(r<g*1.85)&(g<b*2.0)
    lower=yy>315
    paper=(r>100)&(r-g<20)&(g-b<45)
    redpaper=(r>90)&(r>g*1.85)
    matte[lower&(paper|redpaper)&~skin]=0
    # Person segmentation sometimes includes the shoe; retain only skin there.
    matte[(xx>495)&(yy>350)&~skin]=0
    # No disconnected printed cards or table ink belong to the person.
    matte[yy>480]=0
    palm=np.zeros_like(matte)
    palm[lower&skin]=matte[lower&skin]
    candidates=[h['points'] for h in hands[i]['hands'] if 'VNHLKWRI' in h['points']]
    candidates.sort(key=lambda h:h['VNHLKWRI'][0])
    h=candidates[0] if candidates else {}
    tips=[h[k][:2] for k in ['VNHLKITIP','VNHLKMTIP','VNHLKRTIP'] if k in h]
    if tips:
        anchor=np.mean(tips,axis=0).tolist();method='Vision fingertip mean'
    else:
        wrist=h.get('VNHLKWRI', [tracks[-1]['source'][0],tracks[-1]['source'][1]-.045] if tracks else [.53,.56])
        region=(abs(xx-wrist[0]*832)<55)&(yy>wrist[1]*624-12)&(yy<wrist[1]*624+65)&skin&(matte>100)
        ys,xs=np.where(region)
        anchor=[float(np.median(xs)/832),float(np.percentile(ys,85)/624)] if len(xs)>8 else [wrist[0],wrist[1]+.04]
        method='skin-region estimate' if len(xs)>8 else 'wrist offset estimate'
    tracks.append({'frame':i,'source':anchor,'finger':point(anchor),'method':method})
    packed=Image.new('RGB',(W,H*2))
    packed.paste(registered(Image.fromarray(rgb.astype('uint8'))),(0,0))
    channels=np.stack([matte,palm,np.zeros_like(matte)],axis=2).clip(0,255).astype('uint8')
    packed.paste(registered(Image.fromarray(channels)),(0,H))
    target=ROOT/'packed-frames';target.mkdir(exist_ok=True)
    packed.save(target/f'{i+1:04}.png')

(ROOT/'hand-proxies.json').write_text(json.dumps(tracks,indent=2))
specs=[('deal-centre',21,35,23,28,30),('deal-left',34,48,36,40,42),('deal-right',3,22,9,16,18),('deal-dealer',21,35,23,28,30)]
takes=[]
for action,start,stop,pick,release,land in specs:
    path=OUT/f'{action}.mp4'
    subprocess.run(['ffmpeg','-v','error','-y','-framerate','24','-start_number',str(start+1),'-i',str(ROOT/'packed-frames/%04d.png'),'-frames:v',str(stop-start),'-an','-c:v','libx264','-crf','14','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',str(path)],check=True)
    records=[]
    for j,f in enumerate(range(start,stop)):
        x,y=tracks[f]['finger']
        # A fitted game-card footprint, not a claim of observed paper corners.
        corners=[[x-.015,y-.012,0],[x+.015,y-.012,0],[x+.019,y+.014,0],[x-.011,y+.014,0]]
        records.append({'frame':j,'card':{'corners':corners,'faceUp':True} if pick<=f<=land else None,'contact':{'finger':[x,y],'measured':False,'method':tracks[f]['method']}})
    take={'version':1,'id':'astrid-rhythm-'+action,'dealer':'astrid','action':action,'status':'review','playbackRate':1,
      'tracking':{'kind':'hand-proxy','sourceSha256':digest(ROOT.parent/'source.mp4'),'sourceStart':start,'sourceStop':stop,'shoulder':[.43,.30]},
      'media':{'src':str(path.relative_to(PUBLIC)),'sha256':digest(path),'layout':'rgb-over-masks-r-actor-g-fingers','width':W,'height':H,'fps':24,'frames':stop-start},
      'camera':{'width':W,'height':H,'shoeOutlet':point([.65,.60])},'events':{'pickup':pick-start,'release':release-start,'land':land-start,'rest':stop-start-1},'frames':records}
    takes.append(take)
manifest={'version':1,'status':'review','reviewCandidates':[t['id'] for t in takes],'takes':takes}
(OUT/'manifest.json').write_text(json.dumps(manifest))
subprocess.run(['node','--input-type=module','-e',"import fs from 'node:fs';import{createHash}from'node:crypto';import{calibrationPayload}from'./web/public/performance-contact.mjs';const p='web/public/dealers/astrid/performance/rhythm/manifest.json';const m=JSON.parse(fs.readFileSync(p));for(const t of m.takes)t.calibrationSha256=createHash('sha256').update(calibrationPayload(t)).digest('hex');fs.writeFileSync(p,JSON.stringify(m));"],cwd=PUBLIC.parents[1],check=True)
print('Staged four rhythmic takes; hand proxies require visual review.')
