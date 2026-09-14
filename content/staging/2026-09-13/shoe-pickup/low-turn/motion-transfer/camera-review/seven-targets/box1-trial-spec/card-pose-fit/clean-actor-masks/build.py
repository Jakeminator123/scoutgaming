import sys,json,hashlib,pathlib
sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np
from PIL import Image,ImageDraw
cv2.setNumThreads(1)
o=pathlib.Path(__file__).resolve().parent;p=o.parent;b=p.parent
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
rows=[];cap=cv2.VideoCapture(str(b/'source.mp4'));keys=[0,18,30,48,63,80,96];proof=Image.new('RGB',(1280,360*len(keys)))
for n in range(97):
 f=p/f'person-masks/{n:04d}.png';m=np.array(Image.open(f));count,lab,stats,cent=cv2.connectedComponentsWithStats((m>0).astype('uint8'));actor=1+np.argmax(stats[1:,4]); main=(lab==actor).astype('uint8');near=cv2.dilate(main,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(17,17)))>0
 keep=[actor]
 for k in range(1,count):
  if np.any(near&(lab==k)):keep.append(k)
 out=m.copy();out[~np.isin(lab,keep)]=0
 # Exact original values retained throughout connected actor support; no skin threshold/erosion.
 dest=o/f'{n:04d}.png';Image.fromarray(out).save(dest)
 rows.append({'frame':n,'sourceMaskSHA256':sha(f),'outputSHA256':sha(dest),'removedPixels':int(np.count_nonzero(m!=out)),'removedAlphaSum':int((m.astype('int32')-out).sum()),'actorComponentBounds':stats[actor,:4].tolist(),'preservedNearbyComponents':len(keep)-1,'increasedAlphaPixels':0})
 ok,a=cap.read();assert ok
 if n in keys:
  a=cv2.cvtColor(a,cv2.COLOR_BGR2RGB).astype(float);i=keys.index(n)
  for j,mm in enumerate([m,out]):
   x=a*mm[:,:,None]/255+np.array([55,80,90])*(1-mm[:,:,None]/255);proof.paste(Image.fromarray(x.astype('uint8')).resize((640,360)),(640*j,360*i))
  ImageDraw.Draw(proof).text((5,360*i+5),f'{n}: raw / disconnected cleanup',fill='white')
proof.save(o/'before-after.jpg',quality=93)
r={'status':'conservative disconnected-background cleanup; connected leakage unresolved','sourceVideoSHA256':sha(b/'source.mp4'),'count':97,'sourceRGBModified':False,'method':'Keep main actor positive-alpha connected component and all whole components within8 native pixels. No erosion, smoothing or color threshold. Main component includes both hands in inspected keys; preserve all its original values.','limitations':['Connected shoe fragments at0/80/96 remain','Connected shoulder lamp fringe30/96 remains','Connected chair/table bleed near torso0/48 remains','Connected sourcepaper and landedcard63 remain for explicit hand/paper cleanup'],'frames':rows}
(o/'receipt.json').write_text(json.dumps(r,indent=2)+'\n');print('97 complete',sum(x['removedPixels'] for x in rows))
