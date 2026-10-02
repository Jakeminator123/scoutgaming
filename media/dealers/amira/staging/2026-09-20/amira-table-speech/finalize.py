#!/usr/bin/env python3
"""Verify packed native speech assets and write their review-only manifest."""
import hashlib,json,shutil
from pathlib import Path
import cv2
import numpy as np
from PIL import Image,ImageDraw

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[3]
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
lines={}
audits=[]
samples=[]
for p in sorted(HERE.glob('*/line.json')):
    line=json.loads(p.read_text());name=p.parent.name;m=line['media'];lines[name]=line
    cap=cv2.VideoCapture(str(HERE/'media'/f'{name}.mp4'))
    x,y,w,h=m['crop'];mins=[];badge_mins=[];count=0
    while True:
        ok,bgr=cap.read()
        if not ok:break
        assert bgr.shape[:2]==(h*2,w)
        a=cv2.cvtColor(bgr[h:],cv2.COLOR_BGR2GRAY)
        # Interior central face/eyes excluding hair/ears remains opaque even
        # after lossy packed-alpha encoding. Crop follows measured source face.
        face=a[55-y:125-y,605-x:665-x]
        mins.append(int(face.min()))
        badge_mins.append(int(a[255-y:265-y,669-x:706-x].min()))
        if count==m['frames']//2:
            rgb=cv2.cvtColor(bgr[:h],cv2.COLOR_BGR2RGB);aa=a[...,None]/255
            comp=np.round(rgb*aa+np.array([58,46,37])*(1-aa)).astype(np.uint8)
            im=Image.fromarray(comp);im.thumbnail((280,280));samples.append((name,count,im))
        count+=1
    cap.release();assert count==m['frames'],(name,count,m['frames'])
    assert min(mins)>=250,(name,min(mins))
    assert min(badge_mins)>=250,(name,'namebadge transparency',min(badge_mins))
    assert sha(HERE/'media'/f'{name}.mp4')==m['sha256']
    assert sha(REPO/'web/public'/line['audio'])==line['audioSha256']
    assert abs(line['audioMeasurement']['lagSamples'])<=4410,(name,'unexpected audio lag')
    assert line['audioMeasurement']['normalisedPeak']>=.98,(name,'audio mismatch')
    audits.append({'line':name,'frames':count,'minimumEncodedFaceAlpha':min(mins),'minimumEncodedNamebadgeAlpha':min(badge_mins),
      'audioLagMs':round(line['audioMeasurement']['lagSeconds']*1000,4),
      'audioCorrelation':line['audioMeasurement']['normalisedPeak'],
      'mediaSha256':m['sha256'],'audioSha256':line['audioSha256']})
assert 'greeting' in lines
shutil.copyfile(HERE/'greeting/rest.png',HERE/'media/rest.png')
manifest={'version':2,'id':'amira-green-speak-creatify-aurora','dealer':'amira','action':'speak','status':'review','enabled':True,
  'provider':'ElevenLabs Image & Video API, model creatify-aurora 720p',
  'approval':'User supplied existing raw speech. Native source/matte review only; runtime sync and full-table visual acceptance pending.',
  'sourcePlate':{'jobId':'023e8f80','file':'content/staging/2026-09-19/amira-green/plate-1k-rejected-023e8f80.png',
    'note':'Existing speech was generated from the earlier 1K plate, not the newer 2K plate 72100f4f. No new generation.'},
  'spliceOffset':[0,0],'actorOffset':[0,0],
  'rest':{'src':'review/amira-green-speak/rest.png','sha256':sha(HERE/'media/rest.png'),'camera':lines['greeting']['camera'],
    'sourceNativeFrame':0,'temporary':True,'note':'Static source ready pose pending separately prepared Amira idle.'},
  'lines':lines}
(HERE/'speak.json').write_text(json.dumps(manifest,indent=2)+'\n')
(HERE/'audit.json').write_text(json.dumps({'lines':len(lines),'frames':sum(x['frames'] for x in audits),'checks':audits},indent=2)+'\n')
sheet=Image.new('RGB',(280*4,306*((len(samples)+3)//4)),'#191b1e');draw=ImageDraw.Draw(sheet)
for i,(name,n,im) in enumerate(samples):
    px,py=i%4*280,i//4*306;sheet.paste(im,(px,py+24));draw.text((px+5,py+4),f'{name} native {n}',fill='white')
sheet.save(HERE/'bank-contact.jpg',quality=95)
print(json.dumps({'lines':len(lines),'frames':sum(x['frames'] for x in audits),'minimumEncodedFaceAlpha':min(x['minimumEncodedFaceAlpha'] for x in audits),'mediaBytes':sum(p.stat().st_size for p in (HERE/'media').iterdir())}))
