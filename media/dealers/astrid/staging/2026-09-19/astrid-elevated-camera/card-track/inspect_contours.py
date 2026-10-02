from pathlib import Path
import cv2,numpy as np,json
from PIL import Image,ImageDraw
P=Path(__file__).parent
frames=[]; entries=[]
for n in range(97):
 im=cv2.imread(str(P/'frames'/f'{n+1:03}.png'));hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
 mask=cv2.inRange(hsv,np.array([35,70,105]),np.array([57,255,255]))
 mask[:330]=0; mask[:,:500]=0;mask[:,1520:]=0
 ct,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
 ct=[c for c in ct if cv2.contourArea(c)>40]
 if not ct:continue
 # Keep largest card colour group. Other green reflection fragments are excluded.
 c=max(ct,key=cv2.contourArea);x,y,w,h=cv2.boundingRect(c)
 hull=cv2.convexHull(c); approx=cv2.approxPolyDP(hull,3,True)
 ent={'frame':n,'bbox':[x,y,w,h],'hull':hull[:,0].tolist(),'approx':approx[:,0].tolist()};entries.append(ent)
 cx=x+w//2;cy=y+h//2
 crop=im[max(0,cy-150):min(1080,cy+150),max(0,cx-200):min(1920,cx+200)].copy()
 shift=np.array([max(0,cx-200),max(0,cy-150)])
 cv2.polylines(crop,[hull-shift],True,(255,100,0),1)
 for pt in approx[:,0]:
  cv2.circle(crop,tuple(pt-shift),3,(0,0,255),1)
 pil=Image.fromarray(cv2.cvtColor(crop,cv2.COLOR_BGR2RGB)); tile=Image.new('RGB',(400,340),'#111');tile.paste(pil,(0,25))
 d=ImageDraw.Draw(tile);d.text((5,5),f'{n:02} ({n/24:.3f}s) offset {shift.tolist()}','white');d.text((5,323),f'hull {len(hull)} approx {approx[:,0].tolist()}','white')
 frames.append(tile)
for s in range(0,len(frames),20):
 group=frames[s:s+20]; out=Image.new('RGB',(1600,340*5),'black')
 for i,t in enumerate(group):out.paste(t,((i%4)*400,(i//4)*340))
 out.save(P/f'raw-sheet-{s:02}.jpg',quality=92)
(P/'contour-observations.json').write_text(json.dumps(entries,indent=2))
