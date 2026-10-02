#!/usr/bin/env python3
"""Native-only matte for explicitly supplied waiting job 5f2929a3."""
import json,hashlib,importlib.util,subprocess
from pathlib import Path
import cv2,numpy as np
from PIL import Image,ImageDraw

HERE=Path(__file__).resolve().parent;REPO=HERE.parents[3]
SOURCE=REPO/'content/staging/2026-09-19/amira-green/waiting/source.mp4'
EXPECTED='2b36e7ad47595f20cb98431fa7613da525f7513729a7a23e7667a7acb67957cf'
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert sha(SOURCE)==EXPECTED
PREP=REPO/'content/staging/2026-09-19/astrid-elevated-camera/mask-prep'
spec=importlib.util.spec_from_file_location('chroma_key',PREP/'key.py');key=importlib.util.module_from_spec(spec);spec.loader.exec_module(key)
settings=json.loads((PREP/'settings.json').read_text());settings['markerWorkAreaNormalized']=[0,.40,1,1]
for sub in ('alpha','qa','media'):(HERE/sub).mkdir(exist_ok=True)
CROP=[630,12,706,696];x,y,w,h=CROP
camera={'width':w,'height':h,'placement':{'width':1920,'height':1080,'scale':1,'x':x+11,'y':y+1,'framingScale':.85}}
rows=[];union=[1920,1080,0,0];samples=[];cv2.setNumThreads(1)
for n in range(121):
    rgb=np.array(Image.open(HERE/'frames'/f'{n:04d}.png').convert('RGB'))
    person=np.array(Image.open(HERE/'vision'/f'{n:04d}.png').convert('L'))
    alpha=key.actor_alpha(rgb,settings,person)
    outside=1-np.uint8(alpha>=128);cv2.floodFill(outside,None,(0,0),2)
    distance=cv2.distanceTransform(np.uint8(outside!=2),cv2.DIST_L2,5)
    yy,xx=np.indices(alpha.shape)
    face=(xx>=908)&(xx<1008)&(yy>=96)&(yy<217)
    badge=(xx>=980)&(xx<1064)&(yy>=369)&(yy<408)
    protect=(distance>=5)&(((person>=250)&(yy<280))|face|badge)
    alpha[protect]=255
    sy,sx=np.where(alpha>0);b=[int(sx.min()),int(sy.min()),int(sx.max()+1),int(sy.max()+1)]
    union=[min(union[0],b[0]),min(union[1],b[1]),max(union[2],b[2]),max(union[3],b[3])]
    assert b[0]>=x and b[1]>=y and b[2]<=x+w and b[3]<=y+h,(n,b,CROP)
    Image.fromarray(alpha).save(HERE/'alpha'/f'{n:04d}.png')
    a=alpha[y:y+h,x:x+w,None]/255;crop=rgb[y:y+h,x:x+w]
    if n in [0,120]:Image.fromarray(np.dstack([crop,alpha[y:y+h,x:x+w]])).save(HERE/'media'/f'rest-{n:04d}.png')
    if n==0:Image.fromarray(np.dstack([rgb,alpha])).save(HERE/'media/rest-full.png')
    if n%10==0 or n==120:
        comp=np.round(crop*a+np.array([54,45,36])*(1-a)).astype(np.uint8)
        im=Image.fromarray(comp);im.thumbnail((282,280));samples.append((n,im))
    if n in [0,30,60,90,120]:
        sheet=Image.new('RGB',(w*3,h+24),'#17191b');draw=ImageDraw.Draw(sheet)
        for col,bg in enumerate(([54,45,36],[218,218,212],[20,42,52])):
            comp=np.round(crop*a+np.array(bg)*(1-a)).astype(np.uint8)
            sheet.paste(Image.fromarray(comp),(col*w,24));draw.text((col*w+8,5),f'Native waiting {n}',fill='white')
        sheet.save(HERE/'qa'/f'grounds-{n:04d}.jpg',quality=95)
    rows.append({'frame':n,'alphaBounds':b,'alphaSha256':sha(HERE/'alpha'/f'{n:04d}.png'),'protectedPixels':int(protect.sum())})
sheet=Image.new('RGB',(282*5,304*((len(samples)+4)//5)),'#191b1e');draw=ImageDraw.Draw(sheet)
for i,(n,im) in enumerate(samples):
    px,py=i%5*282,i//5*304;sheet.paste(im,(px,py+24));draw.text((px+5,py+4),f'Native waiting {n}',fill='white')
sheet.save(HERE/'qa/contact.jpg',quality=95)
out=HERE/'media/actor-packed.mp4'
vf=f'[0:v]crop={w}:{h}:{x}:{y},format=yuv420p[rgb];[1:v]crop={w}:{h}:{x}:{y},format=yuv420p[a];[rgb][a]vstack=inputs=2[v]'
subprocess.run(['ffmpeg','-v','error','-y','-framerate','24','-start_number','0','-i',str(HERE/'frames/%04d.png'),'-framerate','24','-start_number','0','-i',str(HERE/'alpha/%04d.png'),'-filter_complex',vf,'-map','[v]','-c:v','libx264','-threads','2','-preset','slow','-crf','15','-bf','0','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(out)],check=True)
cap=cv2.VideoCapture(str(out));encoded=[];comp_frames=[]
for n in range(121):
    ok,bgr=cap.read();assert ok
    assert bgr.shape[:2]==(h*2,w)
    a=cv2.cvtColor(bgr[h:],cv2.COLOR_BGR2GRAY)
    face_min=int(a[100-y:210-y,912-x:1004-x].min());badge_min=int(a[375-y:400-y,988-x:1056-x].min())
    assert face_min>=250,(n,'face',face_min)
    assert badge_min>=250,(n,'badge',badge_min)
    encoded.append({'frame':n,'faceAlphaMin':face_min,'badgeAlphaMin':badge_min})
    rgb=cv2.cvtColor(bgr[:h],cv2.COLOR_BGR2RGB);aa=a[...,None]/255
    comp_frames.append(np.round(rgb*aa+np.array([54,45,36])*(1-aa)).astype(np.uint8))
assert not cap.read()[0];cap.release()
motion=[]
for a,b in zip(comp_frames,comp_frames[1:]):motion.append(float(np.abs(a.astype(float)-b.astype(float)).mean()))
seam=float(np.abs(comp_frames[-1].astype(float)-comp_frames[0].astype(float)).mean())
job='5f2929a3-384e-4632-862c-96b1a3f6bfb1'
base={'jobId':job,'src':'review/amira-green-waiting/actor-packed.mp4','sha256':sha(out),'sourceSha256':EXPECTED,'layout':'rgb-over-alpha','width':w,'height':h,'fps':24,'frames':121,'crop':CROP,'loop':True}
manifest={'version':2,'id':'amira-green-waiting-5f2929a3','dealer':'amira','action':'idle','mode':'loop','status':'review','enabled':True,
    'base':base,'camera':camera,'spliceOffset':[0,0],
    'ready':{'src':'review/amira-green-waiting/rest-0000.png','sha256':sha(HERE/'media/rest-0000.png'),'camera':camera,'sourceFrame':0},
    'readyFull':{'src':'review/amira-green-waiting/rest-full.png','sha256':sha(HERE/'media/rest-full.png'),'width':1920,'height':1080,'sourceFrame':0},
    'recommendedSpeechAlignment':{'translation':[11,1],'scale':1,'space':'1920x1080 virtual source pixels','applyToCameraPlacement':{'x':641,'y':13},'applied':True,'limitation':'Aligns face/hair. Independent jacket and left-hand pose differences remain; no single rigid translation matches every body region.'},
    'note':'Only this explicit 5f2929a3 native waiting loop. No folded-pose substitution or generation.',
    'registration':{'method':'Native 1920x1080 source, crop only; same virtual framing as speech plus measured uniform display translation (+11,+1) to align face. No actor scale or RGB warp.','displayTranslation':[11,1],'newPlateComparedWithSpeech':True,'actorWarpApplied':False,'framingScale':.85},
    'sourceSeam':{'lastToFirstCompositeMeanAbsoluteError':seam,'adjacentCompositeMeanAbsoluteErrorMedian':float(np.median(motion)),'adjacentCompositeMeanAbsoluteErrorMax':max(motion),'sourceFirstLastPose':'Close matching ready poses; all121 original frames retained, no crossfade/interpolation.'}}
(HERE/'idle.json').write_text(json.dumps(manifest,indent=2)+'\n')
receipt={'source':str(SOURCE),'sourceSha256':EXPECTED,'sourceDimensions':[1920,1080],'nativeFrames':121,'nativeFps':24,'crop':CROP,'actorUnionBounds':union,'packedDimensions':[w,h*2],'packedSha256':sha(out),'packedBytes':out.stat().st_size,'rgbPolicy':'Native source RGB; no recolour, retiming, interpolation or spatial warp. CRF15 ordinary packed encoding only.','headPolicy':'Enclosed silhouette >=5px; heady<280person>=250 plus measured known solid face[908,96,1008,217] and badge[980,369,1064,408] interiors. Outeredge unchanged.','frames':rows,'encodedChecks':encoded,'sourceSeam':manifest['sourceSeam']}
(HERE/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k not in ('frames','encodedChecks')},indent=2))
