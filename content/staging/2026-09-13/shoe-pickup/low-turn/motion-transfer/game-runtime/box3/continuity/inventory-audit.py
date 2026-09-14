import sys,pathlib,json,hashlib
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2,numpy as np
from PIL import Image,ImageDraw
r=pathlib.Path('/Users/solvifyab/Desktop/croupier');o=r/'content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/game-runtime/box3/continuity';o.mkdir(exist_ok=True)
files=[('contact','content/staging/2026-09-09/contact-proof/source.mp4'),('centre','web/public/dealers/astrid/performance/centre-native-review.mp4'),('left','web/public/dealers/astrid/performance/left-outlet-review.mp4'),('right','web/public/dealers/astrid/performance/right-outlet-review.mp4'),('waiting','web/public/dealers/astrid/performance/joins/ready/loop.mp4'),('waiting-speech','web/public/dealers/astrid/performance/joins/ready/idle.mp4'),('idle','web/public/dealers/astrid/actor/streams/idle-1_idle_idle.h264'),('greeting','web/public/dealers/astrid/actor/streams/idle-1_speak_greeting.h264'),('entry-clean','content/staging/2026-09-09/centre-entry-clean/source.mp4')]
rows=[];samples=[]
for name,f in files:
 p=r/f;c=cv2.VideoCapture(str(p));N=int(c.get(cv2.CAP_PROP_FRAME_COUNT));w=int(c.get(3));h=int(c.get(4));N=N if 0<N<10000 else 1;inds=[0,N-1] if N>1 else [0]
 for n in inds:
  c.set(cv2.CAP_PROP_POS_FRAMES,n);ok,x=c.read()
  if not ok:continue
  # packed videos RGB on top; h264 actual image dimensions retained
  if h==2160:x=x[:w*9//16]
  im=Image.fromarray(cv2.cvtColor(x,cv2.COLOR_BGR2RGB));im.thumbnail((640,360));samples.append((name,n,im))
 rows.append({'name':name,'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'width':w,'height':h,'frameCountEstimate':N})
for page in range((len(samples)+5)//6):
 s=Image.new('RGB',(1920,800),(20,20,20))
 for k,(name,n,im) in enumerate(samples[page*6:page*6+6]):
  s.paste(im,((k%3)*640,(k//3)*400+25));ImageDraw.Draw(s).text(((k%3)*640,(k//3)*400),f'{name} native{n}',fill='white')
 s.save(o/f'endpoints-{page}.jpg',quality=94)
(o/'inventory.json').write_text(json.dumps(rows,indent=2));print(rows)
