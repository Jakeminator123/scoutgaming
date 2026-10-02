import sys,pathlib,json,hashlib
sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np
from PIL import Image,ImageDraw
cv2.setNumThreads(1)
o=pathlib.Path(__file__).resolve().parent;src=o.parent/'camera-review/seven-targets/box1-trial-spec/source.mp4';out=pathlib.Path(sys.argv[1]);a=cv2.VideoCapture(str(src));b=cv2.VideoCapture(str(out));fpsa=a.get(cv2.CAP_PROP_FPS);fpsb=b.get(cv2.CAP_PROP_FPS);fa=[]
while True:
 ok,x=a.read()
 if not ok:break
 fa.append(x)
rows=[];frames=[];n=0
while True:
 ok,x=b.read()
 if not ok:break
 sn=min(len(fa)-1,round(n/fpsb*fpsa));y=fa[sn];z=cv2.resize(x,(y.shape[1],y.shape[0]));d=cv2.absdiff(y,z);rows.append({'outputFrame':n,'outputTime':n/fpsb,'nearestOriginalFrame':sn,'rgbMeanAbsoluteError':float(d.mean()),'faceMAE':float(d[80:310,830:1080].mean()),'shoeMAE':float(d[470:680,1160:1390].mean()),'equalPixels':int(np.all(d==0,axis=2).sum())})
 if n<=round(.9*fpsb) or n%max(1,round(fpsb*.5))==0:frames.append((n,sn,z.copy()))
 n+=1
sheet=Image.new('RGB',(1280,len(frames)*220))
for i,(n,sn,z) in enumerate(frames):
 for j,img in enumerate([fa[sn],z]):
  crop=img[380:710,700:1400] if n/fpsb<1 else img
  im=Image.fromarray(cv2.cvtColor(crop,cv2.COLOR_BGR2RGB));im.thumbnail((640,215));sheet.paste(im,(j*640,i*220))
 ImageDraw.Draw(sheet).text((4,i*220+201),f'output{n} t{n/fpsb:.3f}; original{sn}',fill='red')
sheet.save(o/'seedance-source-output-review.jpg',quality=92)
(o/'seedance-output-metrics.json').write_text(json.dumps({'sourceSHA256':hashlib.sha256(src.read_bytes()).hexdigest(),'outputSHA256':hashlib.sha256(out.read_bytes()).hexdigest(),'outputFPS':fpsb,'outputCount':len(rows),'rows':rows,'note':'Raw appearance comparison, not registered pose or motion proof.'},indent=2)+'\n')
