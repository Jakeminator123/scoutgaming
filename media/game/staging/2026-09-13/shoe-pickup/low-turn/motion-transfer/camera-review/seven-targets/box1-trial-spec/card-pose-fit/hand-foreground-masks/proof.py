import sys;sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np,json
from pathlib import Path
here=Path(__file__).resolve().parent;fit=here.parent;source=fit.parent;cap=cv2.VideoCapture(str(source/'source.mp4'));ledger=json.loads((fit/'issued-card-trajectory-complete-v2.json').read_text())['frames'];art=cv2.imread(str(source.parents[2]/'camera60-draft/cadence-full/actual-card-1.png'),cv2.IMREAD_UNCHANGED)
# Actual game artwork used only as a labeled review prop, never a server card.
if art is None:raise RuntimeError('Review card art missing')
rows=[]
for n in [9,12,18,30,40,48,63]:
 cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,rgb=cap.read();assert ok
 rg=cv2.imread(str(here/'rg'/f'{n:04d}.png'));r=rg[:,:,2]/255;g=rg[:,:,1]/255;rear=np.divide(r-g,1-g,out=np.zeros_like(r),where=(1-g)>0);q=np.array(ledger[n]['cards'][0]['corners'],np.float32);ah,aw=art.shape[:2];H=cv2.getPerspectiveTransform(np.float32([[0,0],[aw,0],[aw,ah],[0,ah]]),q);prop=cv2.warpPerspective(art,H,(1920,1080));pa=prop[:,:,3]/255 if prop.shape[2]==4 else np.max(prop,axis=2)>0;bg=np.zeros_like(rgb)+np.array([40,50,45],np.uint8);out=rgb*rear[:,:,None]+bg*(1-rear[:,:,None]);out=prop[:,:,:3]*pa[:,:,None]+out*(1-pa[:,:,None]);out=rgb*g[:,:,None]+out*(1-g[:,:,None]);out=np.uint8(out)
 cx,cy=q.mean(axis=0).astype(int);x=max(0,cx-130);y=max(0,cy-110);box=(slice(y,y+230),slice(x,x+260));pair=np.concatenate([rgb[box],out[box]],axis=1);cv2.putText(pair,f'n{n} review prop only',(3,18),cv2.FONT_HERSHEY_SIMPLEX,.5,(0,255,255),1);rows.append(pair)
cv2.imwrite(str(here/'key-independent-prop.jpg'),np.concatenate(rows))
