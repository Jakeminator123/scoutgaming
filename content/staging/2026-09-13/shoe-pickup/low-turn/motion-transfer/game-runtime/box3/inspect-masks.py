import sys;sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np,json,hashlib
from pathlib import Path
cv2.setNumThreads(1);here=Path(__file__).resolve().parent;repo=next(p for p in here.parents if p.name=='croupier');src=repo/'content/staging/2026-09-09/contact-proof';cap=cv2.VideoCapture(str(src/'source.mp4'));packed=repo/'web/public/dealers/astrid/performance/centre-native-review.mp4';pc=cv2.VideoCapture(str(packed));tracking=json.load(open(src/'marker-tracking.json'));rows=[];tiles=[]
for n in [0,12,24,36,45,50,60,72,84,92,98,110,130,144]:
 cap.set(1,n);ok,a=cap.read();assert ok;mask=cv2.imread(str(src/f'contact-masks/{n+1:04d}.png'));raw=cv2.imread(str(src/f'person/{n+1:04d}.png'));h,w=a.shape[:2];mh,mw=mask.shape[:2];rg=cv2.resize(mask,(w,h));rr=cv2.resize(raw,(w,h));r=rg[:,:,2]/255;g=rg[:,:,1]/255;comp=(a*r[:,:,None]+np.full_like(a,45)*(1-r[:,:,None])).astype(np.uint8)
 # Whole torso and both hands native frame crop, with original vs R-neutral vs G-red overlay.
 gview=a.copy();gview=(gview*(1-g[:,:,None]*.65)+np.array([0,0,255])*g[:,:,None]*.65).astype(np.uint8)
 ts=[]
 for z in [a,comp,gview]:ts.append(cv2.resize(z[480:890,750:1350],(450,308)))
 tile=np.concatenate(ts,axis=1);cv2.putText(tile,f'source {n}, packed {n+24}: original | R actor | G red',(6,22),0,.6,(0,255,255),1);tiles.append(tile)
 pc.set(1,n+24);ok,b=pc.read();assert ok;delta=np.abs(a.astype(float)-b[:h].astype(float));rows.append({'native':n,'packed':n+24,'sourceSize':[w,h],'maskSize':[mw,mh],'packedRGB_MAE':float(delta.mean()),'tracking':tracking[n],'GoutsideR':int(np.count_nonzero(rg[:,:,1]>rg[:,:,2]))})
for i in range(0,len(tiles),4):cv2.imwrite(str(here/f'mask-review-{i//4}.jpg'),np.concatenate(tiles[i:i+4]))
json.dump({'status':'read-only selected-frame assessment','sourceSHA256':hashlib.sha256((src/'source.mp4').read_bytes()).hexdigest(),'packedSHA256':hashlib.sha256(packed.read_bytes()).hexdigest(),'sourceCount':int(cap.get(7)),'packedCount':int(pc.get(7)),'rows':rows},open(here/'mask-evidence.json','w'),indent=2)
print(rows[0]['sourceSize'],rows[0]['maskSize'])
