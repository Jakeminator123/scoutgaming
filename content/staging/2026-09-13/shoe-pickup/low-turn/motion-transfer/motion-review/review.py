import sys; sys.path.insert(0,"/tmp/astrid-optical-flow")

import cv2
from PIL import Image,ImageDraw
from pathlib import Path
p=Path('/Users/solvifyab/Desktop/croupier/content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer')
c=cv2.VideoCapture(str(p/'source.mp4')); frames=[]
while True:
 ok,b=c.read()
 if not ok:break
 frames.append(Image.fromarray(cv2.cvtColor(b,cv2.COLOR_BGR2RGB)))
o=p/'motion-review'
for start in range(0,len(frames),24):
 sheet=Image.new('RGB',(4*480,6*290))
 d=ImageDraw.Draw(sheet)
 for j,n in enumerate(range(start,min(start+24,len(frames)))):
  im=frames[n].resize((480,270));x=j%4*480;y=j//4*290
  sheet.paste(im,(x,y));d.text((x,y+270),f'n{n} {n/24:.3f}s',fill='white')
 sheet.save(o/f'full-{start:03}.jpg')
for start in [16,36,60,90]:
 sheet=Image.new('RGB',(4*500,5*250));d=ImageDraw.Draw(sheet)
 for j,n in enumerate(range(start,start+20)):
  im=frames[n].crop((760,440,1320,730)).resize((500,230));x=j%4*500;y=j//4*250
  sheet.paste(im,(x,y));d.text((x,y+230),f'n{n}',fill='white')
 sheet.save(o/f'hands-{start:03}.jpg')
