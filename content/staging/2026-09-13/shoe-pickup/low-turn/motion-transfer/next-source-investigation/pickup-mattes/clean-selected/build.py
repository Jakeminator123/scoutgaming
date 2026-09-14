import sys;sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np,json,hashlib
from pathlib import Path
cv2.setNumThreads(1)
here=Path(__file__).resolve().parent;source=here.parents[1]/'kling-primitive.mp4';cap=cv2.VideoCapture(str(source));(here/'rg').mkdir(exist_ok=True)
# Source-visible hardware and paper domain, reviewed all25 images. Only hand
# overlap is retained here; all actor alpha outside this local domain unchanged.
shoe=[[1178,638],[1181,609],[1290,478],[1367,516],[1370,566],[1265,675],[1250,676]]
paper=[[1150,604],[1268,607],[1274,674],[1150,674]]
roi=(1080,530,1280,678);records=[];tiles=[]
for output,n in enumerate(range(0,73,3)):
 cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,bgr=cap.read();assert ok;raw=cv2.imread(str(here.parent/'person'/f'{n:04d}.png'),0);x0,y0,x1,y1=roi;rgb=cv2.cvtColor(bgr[y0:y1,x0:x1],cv2.COLOR_BGR2RGB).astype(float);hsv=cv2.cvtColor(bgr[y0:y1,x0:x1],cv2.COLOR_BGR2HSV);rr,gg,bb=[rgb[:,:,i]for i in range(3)]
 seed=((hsv[:,:,0]>=5)&(hsv[:,:,0]<=28)&(rr>50)&(rr-gg>8)&(gg-bb>3)).astype(np.uint8)
 strong=((hsv[:,:,0]>=6)&(hsv[:,:,0]<=27)&(rr>65)&(rr-gg>20)&(gg-bb>7)&(hsv[:,:,1]>55)).astype(np.uint8);seed=seed & cv2.dilate(strong,np.ones((5,5),np.uint8));count,labels,stats,_=cv2.connectedComponentsWithStats(seed);assert count>1;component=1+np.argmax(stats[1:,cv2.CC_STAT_AREA]);mask=(labels==component).astype(np.uint8)*255
 contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);skin=np.zeros_like(mask);cv2.drawContours(skin,contours,-1,255,-1)
 # One nativepixel exterior allowance retains uncertain actual contact blur;
 # no erosion, no anatomical pixel synthesis, no RGB change.
 soft=cv2.GaussianBlur(cv2.dilate(skin,np.ones((3,3),np.uint8)),(3,3),.55);soft=np.maximum(soft,skin);hand=np.zeros_like(raw);hand[y0:y1,x0:x1]=soft
 domain=np.zeros_like(raw)
 for q in [shoe,paper]:cv2.fillPoly(domain,[np.array(q,np.int32)],255)
 r=raw.copy();r[domain>0]=np.minimum(raw[domain>0],hand[domain>0]);g=np.minimum(raw,hand);g=np.minimum(g,r);rg=cv2.merge([np.zeros_like(r),g,r]);file=here/'rg'/f'{n:04d}.png';assert cv2.imwrite(str(file),rg)
 boundary=cv2.dilate(skin,np.ones((5,5),np.uint8))-cv2.erode(skin,np.ones((5,5),np.uint8));record={'outputFrame':output,'sourceNative':n,'sourcePTS':n/24,'file':f'rg/{n:04d}.png','sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'rawMaskSHA256':hashlib.sha256((here.parent/'person'/f'{n:04d}.png').read_bytes()).hexdigest(),'changedRPixels':int(np.count_nonzero(r!=raw)),'handContourSource':[[[int(p[0][0]+x0),int(p[0][1]+y0)]for p in c]for c in contours],'uncertainBoundaryPixels':int(np.count_nonzero(boundary))};records.append(record)
 alpha=r[:,:,None]/255;comp=(bgr*alpha+np.array([45,50,45])*(1-alpha)).astype('uint8');box=(slice(560,680),slice(1100,1290));pair=np.concatenate([bgr[box],comp[box]],axis=1);cv2.putText(pair,f'n{n}',(3,15),cv2.FONT_HERSHEY_SIMPLEX,.5,(0,255,255),1);tiles.append(pair)
for group,start in enumerate(range(0,25,5)):
 cv2.imwrite(str(here/f'proof-{group}.jpg'),np.concatenate(tiles[start:start+5]))
manifest=json.dumps(records,separators=(',',':'));receipt={'status':'DRAFT source-specific hand silhouette, awaiting source contact proof inspection','sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'count':25,'selectedNative':list(range(0,73,3)),'dimensions':[1920,1080],'channels':'PNG R=rawperson minus shoe/paper domain except observed hand silhouette; G=observed hand alpha<=R; B0','unchanged':'All sourceRGB, all raw73 masks; R outside reviewed local shoe/paper domain byte-exact','domains':{'shoe':shoe,'paper':paper},'contourMethod':'Source-visible warm connected drawing-hand component in explicit contactROI; external contour filled only interior holes;1nativepx exterior allowance,0.55sigma alpha-only blur; originalskinRGB never altered','uncertainty':'Native sourceblur at finger/blacktray or card boundary; candidate contours are source-derived not manual per-pixel measurements. Allselected frames require review. No turnover/delivery evidence.','manifestSHA256':hashlib.sha256(manifest.encode()).hexdigest(),'frames':records};(here/'receipt.json').write_text(json.dumps(receipt,indent=2));print(receipt['manifestSHA256'])
