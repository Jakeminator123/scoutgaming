from pathlib import Path
import sys,json
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2
p=Path(__file__).parent;src=p.parent/'mattes/return'
for d in ['r','g','rg','checker']:(p/d).mkdir(exist_ok=True)
yy,xx=np.indices((1080,1920));rows=[];tiles=[]
for n in range(41):
 rgb=np.array(Image.open(src/'frames'/f'{n+1:04}.png').convert('RGB'));m=np.array(Image.open(src/'person'/f'{n+1:04}.png').convert('L'));r,g,b=rgb.astype(np.int16).transpose(2,0,1)
 # Keep actor-connected high confidence component: discard disconnected table feet.
 core=(m>195).astype(np.uint8);num,lab,stats,c=cv2.connectedComponentsWithStats(core,8);idx=1+np.argmax(stats[1:,4]);support=(lab==idx).astype(np.uint8)*255
 support=cv2.dilate(support,np.ones((7,7),np.uint8));a=np.minimum(np.clip((m.astype(float)-195)/30,0,1)*255,support)
 # Source card stays below y~850; include wide safety region only where hand has withdrawn.
 paper=(xx>885)&(xx<1005)&(yy>825)&(yy<985)
 skin=((r-g>16)&(r-b>28)&((r-g)>(g-b)*1.2)&(r>80)&(g>42)&(m>60)&(yy>495)&(yy<860)&(xx>800)&(xx<1330)&~paper).astype(np.uint8)
 num,lab,stats,c=cv2.connectedComponentsWithStats(skin,8);sk=np.zeros_like(m)
 for k in range(1,num):
  x,y,w,h,area=stats[k]
  if area>250 and y<800:sk[lab==k]=255
 shoe=(xx>1150)&(xx<1435)&(yy>465)&(yy<720)
 felt=(g>r*1.06)&(g>b*1.025)&(yy>560)
 lettering=(r>105)&(g>90)&(b<g*.88)&(yy>650)&(sk==0)
 a[paper|shoe|felt|lettering]=0
 soft=cv2.GaussianBlur(sk,(3,3),.55);soft=np.minimum(soft,np.clip((m.astype(float)-40)/80,0,1)*255)
 a=np.uint8(np.round(np.maximum(a,soft)));fg=np.minimum(a,soft).astype(np.uint8)
 Image.fromarray(a).save(p/'r'/f'{n:04}.png');Image.fromarray(fg).save(p/'g'/f'{n:04}.png');Image.fromarray(np.stack([a,fg,np.zeros_like(a)],2)).save(p/'rg'/f'{n:04}.png')
 checker=np.where(((xx//24+yy//24)%2)[...,None],np.array([145,150,155]),np.array([75,85,95]));
 # float multiplication avoids uint8 overflow in composite
 view=Image.fromarray((rgb.astype(float)*(a[...,None]/255)+checker*(1-a[...,None]/255)).astype('uint8'));view.save(p/'checker'/f'{n:04}.jpg',quality=90)
 if n in [0,5,12,20,28,36,40]:
  tile=Image.new('RGB',(1000,400),'#222');tile.paste(view.resize((640,360)),(0,25));tile.paste(Image.fromarray(np.stack([a,fg,np.zeros_like(a)],2)).crop((820,490,1370,890)).resize((360,262)),(640,25));ImageDraw.Draw(tile).text((5,5),f'return n{n} DRAFT',fill='white');tiles.append(tile)
 rows.append({'frame':n,'actorPixels':int((a>127).sum()),'skinPixels':int((fg>127).sum()),'paperAlpha':int((a[paper]>127).sum())})
sheet=Image.new('RGB',(1000,len(tiles)*400));
for i,t in enumerate(tiles):sheet.paste(t,(0,i*400))
sheet.save(p/'review.jpg',quality=92);(p/'receipt.json').write_text(json.dumps({'status':'draft-unapproved','frames':rows,'source':'../mattes/return','knownRisk':'paper ROI may clip initial fingertips; targetn5–36 requires inspection'},indent=2))
