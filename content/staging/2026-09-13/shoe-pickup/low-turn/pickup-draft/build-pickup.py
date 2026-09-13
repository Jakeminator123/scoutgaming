from pathlib import Path
import sys,json,hashlib
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2
p=Path(__file__).resolve().parent;src=p.parent/'mattes/source'
# Visible card vicinity estimates; bounding regions are deliberately not hidden corners.
keys={0:[1200,590,1275,666],7:[1200,590,1275,666],13:[1178,595,1270,668],19:[1162,595,1254,670],25:[1060,520,1146,607],31:[1027,503,1119,597],36:[1027,520,1110,594],37:[1037,540,1115,591],38:[1042,551,1118,594],39:[1045,557,1119,592],40:[1054,579,1124,599],41:[1057,591,1129,609],42:[1060,604,1128,624],43:[1061,608,1135,636],44:[1062,610,1141,646],45:[1062,613,1144,652],54:[1050,612,1143,657],66:[1050,612,1143,657]}
for d in ['pickup-rg','pickup-checker']:(p/d).mkdir(exist_ok=True)
yy,xx=np.indices((1080,1920));checker=np.where(((xx//24+yy//24)%2)[...,None],[85,100,112],[150,162,174]).astype(np.uint8);rows=[];tiles=[]
for n in range(67):
 rgb=np.array(Image.open(src/'frames'/f'{n+1:04d}.png').convert('RGB'));m=np.array(Image.open(src/'person'/f'{n+1:04d}.png').convert('L'));r,g,b=rgb.astype(np.int16).transpose(2,0,1)
 left=max(k for k in keys if k<=n);right=min(k for k in keys if k>=n);t=0 if left==right else (n-left)/(right-left);box=np.round(np.array(keys[left])*(1-t)+np.array(keys[right])*t).astype(int);x0,y0,x1,y1=box
 region=(xx>=x0)&(xx<=x1)&(yy>=y0)&(yy<=y1)
 skin=((r-g>16)&(r-b>28)&((r-g)>(g-b)*1.1)&(g>r*.43)&(b>g*.42)&(r>80)&(g>42)&(m>40)&(yy>470)&(yy<750)&(xx>800)&(xx<1310)).astype(np.uint8)
 num,lab,stats,_=cv2.connectedComponentsWithStats(skin,8);sk=np.zeros_like(m)
 for k in range(1,num):
  x,y,w,h,area=stats[k]
  if area>350 and y<590:sk[lab==k]=255
 # Break narrow pink card-border bridges without imposing invented hand geometry.
 opened=cv2.morphologyEx(sk,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
 nearby=cv2.dilate(opened,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)));sk=np.minimum(sk,nearby)
 num2,lab2,stats2,_=cv2.connectedComponentsWithStats((sk>0).astype(np.uint8),8)
 for k in range(1,num2):
  if stats2[k,4]<350:sk[lab2==k]=0
 # Face-up artwork has skin-like pigments, so only restore observed gripping edge side.
 if n>=43:sk[region&(xx>1084)]=0
 a=np.clip((m.astype(float)-195)/30,0,1)*255
 core=(m>205).astype(np.uint8)*255;core=cv2.morphologyEx(core,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(11,11)));core=cv2.erode(core,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)));core=cv2.GaussianBlur(core,(5,5),1)
 upper=np.clip((550-yy)/40,0,1);a=a*(1-upper)+np.minimum(a,core)*upper
 shoe=(xx>1140)&(xx<1400)&(yy>475)&(yy<725)
 felt=(g>r*1.06)&(g>b*1.025)&(yy>550);lettering=(r>105)&(g>90)&(b<g*.88)&(yy>650)&(sk==0)
 rail=(n>=22)&(n<=39)&(xx>880)&(xx<1140)&(yy>548)&(yy<584)
 a[region|shoe|felt|lettering|rail]=0
 soft=cv2.GaussianBlur(sk,(3,3),.55);soft=np.minimum(soft,np.clip((m.astype(float)-40)/80,0,1)*255)
 a=np.maximum(a,soft).round().astype(np.uint8);fg=np.minimum(a,soft).astype(np.uint8);rg=np.stack([a,fg,np.zeros_like(a)],2);Image.fromarray(rg).save(p/'pickup-rg'/f'{n:04d}.png')
 view=(rgb*a[:,:,None]/255+checker*(1-a[:,:,None]/255)).astype(np.uint8) if False else (rgb*(a[:,:,None]/255)+checker*(1-a[:,:,None]/255)).astype(np.uint8);Image.fromarray(view).save(p/'pickup-checker'/f'{n:04d}.jpg',quality=94)
 tile=Image.new('RGB',(800,330),'#222');tile.paste(Image.fromarray(rgb).crop((880,480,1380,780)).resize((400,240)),(0,20));tile.paste(Image.fromarray(view).crop((880,480,1380,780)).resize((400,240)),(400,20));ImageDraw.Draw(tile).text((5,270),f'n{n} source / DRAFT cleaned; region {box.tolist()}',fill='white');tiles.append(tile)
 rows.append({'frame':n,'cardRemovalBoundsNative':box.tolist(),'method':'manual visible vicinity estimate' if n in keys else 'linear interpolation between manual visible vicinity estimates','boundUncertaintyPixels':8 if 36<=n<=45 else 12,'visibleCardCornersNative':None,'hiddenCorners':None,'contactMeasured':False,'cardVisibility':'inside shoe or partly occluded' if n<14 else 'red back' if n<40 else 'edge-on blurred' if n<43 else 'face-up','visibleSkinPixels':int((fg>128).sum())})
for page in range(6):
 s=Image.new('RGB',(1600,1980),'#222')
 for j,tile in enumerate(tiles[page*12:page*12+12]):s.paste(tile,(j%2*800,j//2*330))
 s.save(p/f'review-{page}.jpg',quality=94)
(p/'observations.json').write_text(json.dumps({'status':'DRAFT estimated visible vicinity bounds; not card geometry or contact measurements','dimensions':[1920,1080],'frames':rows},indent=2)+'\n')
h={str(f.relative_to(p)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((p/'pickup-rg').glob('*.png'))};h['build-pickup.py']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest();(p/'SHA256.json').write_text(json.dumps(h,indent=2)+'\n')
