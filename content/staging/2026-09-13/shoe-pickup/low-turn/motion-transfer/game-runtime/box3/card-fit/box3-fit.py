import sys,pathlib,json
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2,numpy as np
from PIL import Image,ImageDraw
r=pathlib.Path('/Users/solvifyab/Desktop/croupier');o=r/'content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/game-runtime/box3/card-fit';o.mkdir(exist_ok=True)
c=cv2.VideoCapture(str(r/'content/staging/2026-09-09/contact-proof/source.mp4'));rows=[]
for n in [38,45,49,57,72,84,91,92,94]:
 c.set(cv2.CAP_PROP_POS_FRAMES,n);ok,x=c.read();rgb=cv2.cvtColor(x,cv2.COLOR_BGR2RGB);mask=cv2.inRange(x,np.array([140,165,180]),np.array([245,255,255]));mask[:610]=0;mask[900:]=0;mask[:,:880]=0;mask[:,1310:]=0
 cc,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);cc=[v for v in cc if cv2.contourArea(v)>5];cc.sort(key=cv2.contourArea,reverse=True)
 cs=[cv2.approxPolyDP(v,2,True)[:,0].tolist() for v in cc[:3]];rows.append({'frame':n,'contourCandidates':cs})
 im=Image.fromarray(rgb).crop((880,570,1360,900)).resize((960,660));d=ImageDraw.Draw(im)
 for poly in cs[:1]:
  for a in poly:
   pt=((a[0]-880)*2,(a[1]-570)*2);d.ellipse((pt[0]-3,pt[1]-3,pt[0]+3,pt[1]+3),fill='red');d.text(pt,str(a),fill='red')
 im.save(o/f'observed-{n:03}.jpg',quality=95)
(o/'contour-candidates.json').write_text(json.dumps(rows,indent=2))
print(rows)
