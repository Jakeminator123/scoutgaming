import sys;sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np,json,hashlib
from pathlib import Path
cv2.setNumThreads(1)
here=Path(__file__).resolve().parent;fit=here.parent;source=fit.parent;ledger=json.loads((fit/'issued-card-trajectory-complete-v2.json').read_text())['frames'];cap=cv2.VideoCapture(str(source/'source.mp4'))
for d in ['g','paper-delta','uncertain','rg']: (here/d).mkdir(exist_ok=True)
rows=[];proof=[]
for n,row in enumerate(ledger):
 ok,bgr=cap.read();assert ok;rgb=cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB);raw=cv2.imread(str(fit/'person-masks'/f'{n:04d}.png'),0);h,w=raw.shape;g=np.zeros_like(raw);paper=np.zeros_like(raw);uncertain=np.zeros_like(raw)
 if row['cards']:
  q=np.array(row['cards'][0]['corners'],np.int32);roi=np.zeros_like(raw);cv2.fillConvexPoly(roi,cv2.convexHull(q),255);near=cv2.dilate(roi,np.ones((71,71),np.uint8));search=cv2.dilate(roi,np.ones((19,19),np.uint8));rr,gg,bb=[rgb[:,:,i].astype(float)for i in range(3)];hsv=cv2.cvtColor(bgr,cv2.COLOR_BGR2HSV);hue=hsv[:,:,0].astype(float)
  # Source-color evidence, not card geometry, defines every foreground pixel.
  warm=(hue>=6)&(hue<=27)&(rr-gg>12)&(gg-bb>6)&(rr>65)&(raw>2)&(near>0)
  count,labels,stats,_=cv2.connectedComponentsWithStats(warm.astype(np.uint8));keep=np.zeros_like(warm)
  for k in range(1,count):
   if stats[k,cv2.CC_STAT_AREA]>=35:keep|=labels==k
  # Retain weak warm pixels only when source-connected to a strong actual
  # hand component. Isolated red ink and distant gold lettering stay excluded.
  weak=(hue>=4)&(hue<=30)&(rr-gg>6)&(gg-bb>2)&(rr>45)&(raw>2)&(near>0)
  count,wl,ws,_=cv2.connectedComponentsWithStats(weak.astype(np.uint8));supported=np.zeros_like(keep)
  for k in range(1,count):
   component=wl==k
   if np.count_nonzero(component&keep)>=20:supported|=component
  keep=supported
  if n<=63:g[keep]=raw[keep]
  uncertain[weak&~keep]=255
  neutral=(np.max(rgb,axis=2).astype(float)-np.min(rgb,axis=2)<35)&(np.min(rgb,axis=2)>105)&(search>0)&~cv2.dilate(keep.astype(np.uint8),np.ones((3,3),np.uint8)).astype(bool)
  # Fill interior print holes in observed white-paper contours, never quad.
  contours,_=cv2.findContours(neutral.astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
  for contour in contours:
   if cv2.contourArea(contour)>=30:cv2.drawContours(paper,[contour],-1,255,-1)
  paper[keep]=0;paper[(uncertain>0)&(cv2.dilate(keep.astype(np.uint8),np.ones((7,7),np.uint8))>0)]=0
  if n in [9,12,18,30,40,48,63]:
   cx,cy=q.mean(axis=0).astype(int);x=max(0,cx-115);y=max(0,cy-100);box=(slice(y,y+200),slice(x,x+230));overlay=bgr.copy();overlay[g>0]=((overlay[g>0].astype(float)*.5)+np.array([0,255,0])*.5).astype(np.uint8);overlay[paper>0]=((overlay[paper>0].astype(float)*.5)+np.array([0,0,255])*.5).astype(np.uint8);pair=np.concatenate([bgr[box],overlay[box],cv2.cvtColor(g[box],cv2.COLOR_GRAY2BGR)],axis=1);cv2.putText(pair,f'n{n} {x},{y}',(4,18),cv2.FONT_HERSHEY_SIMPLEX,.5,(0,255,255),1);proof.append(pair)
 for name,a in [('g',g),('paper-delta',paper),('uncertain',uncertain)]:cv2.imwrite(str(here/name/f'{n:04d}.png'),a)
 clean=cv2.imread(str(fit/'clean-actor-masks'/f'{n:04d}.png'),0);clean[paper>0]=0;g=np.minimum(g,clean);rg=np.stack([clean,g,np.zeros_like(g)],axis=2);cv2.imwrite(str(here/'rg'/f'{n:04d}.png'),cv2.cvtColor(rg,cv2.COLOR_RGB2BGR));rows.append({'rgSHA256':hashlib.sha256((here/'rg'/f'{n:04d}.png').read_bytes()).hexdigest(),'frame':n,'gPixels':int(np.count_nonzero(g)),'paperProposalPixels':int(np.count_nonzero(paper)),'uncertainPixels':int(np.count_nonzero(uncertain)),'gSHA256':hashlib.sha256((here/'g'/f'{n:04d}.png').read_bytes()).hexdigest()})
cv2.imwrite(str(here/'key-candidate.jpg'),np.concatenate(proof))
(here/'receipt.json').write_text(json.dumps({'status':'UNREVIEWED source-color candidate; not final RG','sourceSHA256':hashlib.sha256((source/'source.mp4').read_bytes()).hexdigest(),'frameRange':[0,96],'dimensions':[1920,1080],'gMeaning':'original person alpha only at source-visible connected warm foreground; zero after63','paperDelta':'candidate observed neutral paper contours/print holes; not blanket quad; needs source review before R changes','uncertainty':'Hard warm classifier can omit blurred/dark skin or include warm ink/lettering; uncertain masks explicit. No hidden anatomy invented, no RGB changes.','rows':rows},indent=2))
