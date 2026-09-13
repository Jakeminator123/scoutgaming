from pathlib import Path
import sys,json,hashlib
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2
p=Path(__file__).resolve().parent;src=p.parent/'mattes/slide';obsfile=p.parent.parent/'integration-diagnostic/slide-contact/observations.json';obs=json.loads(obsfile.read_text())
for d in ['slide-r','slide-g','slide-rg','slide-checker']: (p/d).mkdir(exist_ok=True)
rows=[];tiles=[]
yy,xx=np.indices((1080,1920));checker=np.where(((xx//24+yy//24)%2)[...,None],np.array([85,100,112]),np.array([150,162,174])).astype(np.uint8)
for n in range(55):
 rgb=np.array(Image.open(src/'frames'/f'{n+1:04d}.png').convert('RGB'));m=np.array(Image.open(src/'person'/f'{n+1:04d}.png').convert('L'));r,g,b=rgb.astype(np.int16).transpose(2,0,1)
 # Strict connected visible skin only. No inpainting, hull-completed hands or invented fingers.
 skin=((r-g>16)&(r-b>28)&((r-g)>(g-b)*1.2)&(r>80)&(g>42)&(m>60)&(yy>495)&(yy<900)&(xx>790)&(xx<1330)).astype(np.uint8)
 num,lab,stats,cent=cv2.connectedComponentsWithStats(skin,8);kept=[];sk=np.zeros_like(m)
 for k in range(1,num):
  x,y,w,h,area=stats[k]
  # Separate hand components must have substantial area and connect to wrist-height skin.
  if area>250 and ((x<1150 and y < min(q[1] for q in obs['frames'][n]['visiblePaperPolygonNative'])-10) or (x>=1150 and y<620)):sk[lab==k]=255;kept.append({'area':int(area),'bbox':[int(x),int(y),int(w),int(h)]})
 # Conservative person core avoids weak ghost objects. Existing upper-edge cleanup style.
 a=np.clip((m.astype(float)-195)/30,0,1)*255
 core=(m>205).astype(np.uint8)*255;core=cv2.morphologyEx(core,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(11,11)));core=cv2.erode(core,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)));core=cv2.GaussianBlur(core,(5,5),1)
 upper=np.clip((590-yy)/40,0,1);a=a*(1-upper)+np.minimum(a,core)*upper
 hull=np.array(obs['frames'][n]['visiblePaperHullNative'],np.int32);paper=np.zeros_like(m);cv2.fillConvexPoly(paper,hull,255);paper=cv2.dilate(paper,np.ones((5,5),np.uint8))
 # Observed fingertip bounds source paper only; reject connected red/gold print below it.
 fingertip=obs['frames'][n]['fingerCandidateNative'];sk[(paper>0)&((yy>fingertip[1]+3)|(xx>fingertip[0]+3))]=0
 shoe=(xx>1150)&(xx<1435)&(yy>465)&(yy<720)
 # Remove obvious felt / gold lettering only below torso. Clothing is dark neutral.
 felt=(g>r*1.06)&(g>b*1.025)&(yy>560)
 lettering=(r>105)&(g>90)&(b<g*.88)&(yy>650)&(sk==0)
 remove=(paper>0)|shoe|felt|lettering
 a[remove]=0
 # Visible connected skin restores fingers even where person model included object context.
 soft=cv2.GaussianBlur(sk,(3,3),.55);soft=np.minimum(soft,np.clip((m.astype(float)-40)/80,0,1)*255)
 a=np.maximum(a,soft);a=np.uint8(np.round(a));fg=np.minimum(a,soft).astype(np.uint8)
 Image.fromarray(a).save(p/'slide-r'/f'{n:04d}.png');Image.fromarray(fg).save(p/'slide-g'/f'{n:04d}.png');Image.fromarray(np.stack([a,fg,np.zeros_like(a)],axis=2)).save(p/'slide-rg'/f'{n:04d}.png')
 view=(rgb*(a[:,:,None]/255)+checker*(1-a[:,:,None]/255)).astype(np.uint8);Image.fromarray(view).save(p/'slide-checker'/f'{n:04d}.jpg',quality=93)
 tile=Image.new('RGB',(700,350),'#222');tile.paste(Image.fromarray(view).crop((820,520,1380,900)).resize((500,340)),(0,0));tile.paste(Image.fromarray(np.stack([a,fg,np.zeros_like(a)],2)).crop((850,560,1160,880)).resize((200,207)),(500,0));ImageDraw.Draw(tile).text((505,215),f'n{n} R actor\nG visible skin\nDRAFT',fill='white');tiles.append(tile)
 rows.append({'frame':n,'skinComponents':kept,'visibleSkinPixels':int((fg>128).sum()),'paperRegionRemainingAlphaPixels':int(((paper>0)&(a>128)).sum()),'contactMeasured':False,'status':'draft-conservative-connected-RGB-skin; highlights/occluded skin uncertain'})
for page in range(5):
 sheet=Image.new('RGB',(1400,6*350),'#222')
 for j,t in enumerate(tiles[page*12:page*12+12]):sheet.paste(t,(j%2*700,j//2*350))
 sheet.save(p/f'slide-review-{page}.jpg',quality=93)
(p/'slide-receipt.json').write_text(json.dumps({'status':'DRAFT NOT APPROVED','frames':55,'indexing':'output zero-based native n0–54; input numbered n+1','observationSha256':hashlib.sha256(obsfile.read_bytes()).hexdigest(),'rows':rows,'limitations':['Connected RGB skin is conservative, not anatomical segmentation','No missing/occluded pixels reconstructed','G covers visible connected hand skin, not individually labelled fingers','Requires checkerboard native-frame inspection and final game composite']},indent=2)+'\n')
