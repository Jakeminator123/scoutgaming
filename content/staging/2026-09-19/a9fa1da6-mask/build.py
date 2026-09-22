from pathlib import Path
import cv2, numpy as np, json, hashlib
from PIL import Image,ImageDraw
D=Path(__file__).resolve().parent
for folder in ['alpha','rgba','preview-frames','review']: (D/folder).mkdir(exist_ok=True)
Y,X=np.indices((720,1280)); rows=[]
track=json.loads((D/'card-reference.json').read_text())['path_px_1280x720']
shoe=np.zeros((720,1280),np.uint8)
cv2.fillPoly(shoe,[np.array([[784,401],[859,315],[915,338],[913,382],[846,449],[783,424]])],1)
for p in sorted((D/'frames').glob('*.png')):
 rgb=np.array(Image.open(p).convert('RGB')); a=np.array(Image.open(D/'vision'/p.name).convert('L'))
 r,g,b=rgb.astype(float).transpose(2,0,1)
 skin=(r-g>14)&(g-b>6)&(r<g*2.2)&(g>b*1.08)&(r>65)
 safeSkin=cv2.dilate((skin&(a>65)).astype(np.uint8),np.ones((3,3),np.uint8))>0
 n=int(p.stem)-1
 earlyCard=np.zeros_like(a)
 if n<16:
  red=((r>g*1.85)&(r>b*1.8)&(r>35)&(X>787)&(X<843)&(Y>315)&(Y<435)).astype(np.uint8)
  contours,_=cv2.findContours(red,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
  if contours:
   c=max(contours,key=cv2.contourArea)
   if cv2.contourArea(c)>6:
    (cx,cy),(cw,ch),ang=cv2.minAreaRect(c)
    box=cv2.boxPoints(((cx,cy),(cw+5,ch+5),ang)).round().astype(np.int32)
    cv2.fillPoly(earlyCard,[box],1)
 # Source-observed static shoe exclusion; never use this stencil to erase skin.
 exclude=(shoe>0)&~safeSkin&~(earlyCard>0)
 # Visible lamp fragments outside the source shoulder/neck silhouette.
 lamps=(((X>545)&(X<620)&(Y>156)&(Y<184))|((X>698)&(X<745)&(Y>160)&(Y<187)))&(r>70)
 exclude|=lamps
 # The user explicitly chose to keep the original card.
 n=int(p.stem)-1
 point=track[n]
 card=earlyCard.copy()
 if point is not None:
  cx,cy=point
  roiCard=((X-cx)**2/55**2+(Y-cy)**2/58**2)<1
  white=(r>140)&(g>130)&(b>115)&(r-b<85)
  candidate=(roiCard&white&~(shoe>0)).astype(np.uint8)
  crossing={37:[[753,352],[765,346],[816,342],[824,348],[822,363],[810,377],[774,378],[754,369]],38:[[770,374],[778,368],[814,372],[825,375],[835,386],[835,396],[820,410],[784,404],[771,394]],39:[[779,399],[795,388],[848,405],[846,414],[829,441],[790,427]],40:[[770,416],[790,402],[845,430],[824,464],[779,441]]}
  if n in crossing:
   region=np.zeros_like(a);cv2.fillPoly(region,[np.array(crossing[n],np.int32)],1)
   candidate=((region>0)&(r>95)&(g>90)&(b>75)).astype(np.uint8)
  candidate=cv2.morphologyEx(candidate,cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
  contours,_=cv2.findContours(candidate,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
  if contours:cv2.drawContours(card,[max(contours,key=cv2.contourArea)],-1,1,cv2.FILLED)
  card=cv2.morphologyEx(card,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
  exclude[card>0]=False
 # Remove grey rail highlights only; skin and black suit remain protected.
 rail=(Y>=348)&(Y<=371)&(X>540)&(X<780)&(np.abs(r-g)<9)&(np.abs(r-b)<12)&(r>26)
 exclude|=rail&~safeSkin
 # Felt may be attached to the coarse person mask; it is not foreground.
 exclude|=(Y>342)&(g>r*1.07)&(g>b*1.07)&~safeSkin
 trimap=np.full(a.shape,cv2.GC_PR_BGD,np.uint8)
 trimap[a>35]=cv2.GC_PR_FGD
 fg=cv2.erode((a>=250).astype(np.uint8),np.ones((7,7),np.uint8))>0
 trimap[fg]=cv2.GC_FGD
 trimap[(a<8)|exclude|(Y<43)|(Y>600)|(X<420)|(X>880)]=cv2.GC_BGD
 # Source-observed sleeve corridor during the long reach; segmentation loses it.
 if 38<=n<=65:
  wristX=np.interp(n,[38,42,48,52,56,60,65],[698,687,591,541,539,571,675])
  wristY=np.interp(n,[38,42,48,52,56,60,65],[365,369,370,369,368,362,351])
  line=np.zeros_like(a);cv2.line(line,(573,278),(int(wristX),int(wristY)),255,12)
  suit=(line>0)&(r<50)&(g<50)&(b<55)&(a>12)
  trimap[suit]=cv2.GC_FGD
 trimap[card>0]=cv2.GC_FGD
 # Native boundaries sharpened against original source colour; no RGB painting.
 roi=(slice(40,601),slice(420,921)); patch=trimap[roi].copy()
 cv2.setRNGSeed(0)
 cv2.grabCut(cv2.cvtColor(rgb[roi],cv2.COLOR_RGB2BGR),patch,None,np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),3,cv2.GC_INIT_WITH_MASK)
 binary=np.zeros_like(a); binary[roi]=np.isin(patch,[cv2.GC_FGD,cv2.GC_PR_FGD]).astype(np.uint8)
 # Keep the actual actor-connected component, drop stray background islands.
 count,labels,stats,_=cv2.connectedComponentsWithStats(binary,8)
 keep=[]
 for k in range(1,count):
  component=labels==k
  if stats[k,4]>30 and (np.any(component&(a>230)) or np.any(component&(card>0))):keep.append(k)
 binary=np.isin(labels,keep).astype(np.uint8)
 # Below the wrists, keep only source-observed skin and the card, not gold table text.
 skinTight=(r>g*1.18)&(r-g>19)&(r>b*1.3)&(r>40)
 protectHand=cv2.dilate(skinTight.astype(np.uint8),np.ones((3,3),np.uint8))>0
 protectCard=cv2.dilate(card,np.ones((3,3),np.uint8))>0
 binary[(Y>420)&~protectHand&~protectCard]=0
 # A subpixel edge, with opaque original interior. No global face/skin filter.
 alpha=cv2.GaussianBlur(binary.astype(np.float32),(3,3),.55)
 alpha=np.round(alpha*255).astype(np.uint8)
 Image.fromarray(alpha).save(D/'alpha'/p.name)
 Image.fromarray(np.dstack([rgb,alpha])).save(D/'rgba'/p.name)
 checker=np.where((((X//24)+(Y//24))%2)[...,None]==0,np.array([45,51,57]),np.array([64,70,77]))
 preview=np.round(rgb*(alpha[...,None]/255)+checker*(1-alpha[...,None]/255)).astype(np.uint8)
 Image.fromarray(preview).save(D/'preview-frames'/p.name)
 rows.append({'frame':int(p.stem)-1,'alphaSha256':hashlib.sha256((D/'alpha'/p.name).read_bytes()).hexdigest(),'visiblePixels':int((alpha>127).sum())})
 if int(p.stem)%12==1:print('masked',p.stem,flush=True)
for start in range(0,len(rows),12):
 sheet=Image.new('RGB',(1440,1440),(28,28,28));draw=ImageDraw.Draw(sheet)
 for j,row in enumerate(rows[start:start+12]):
  n=row['frame']+1;im=Image.open(D/'preview-frames'/f'{n:04d}.png').crop((450,40,900,570)).resize((360,424))
  x=(j%4)*360;y=(j//4)*480;sheet.paste(im,(x,y+24));draw.text((x+8,y+5),f'Frame {n}/73',fill='white')
 sheet.save(D/'review'/f'sheet-{start:02d}.jpg',quality=94)
(D/'mask-frames.json').write_text(json.dumps(rows,indent=2)+'\n')
print('done',len(rows),flush=True)
