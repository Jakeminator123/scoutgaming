from pathlib import Path
import sys,json,hashlib
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2
p=Path(__file__).resolve().parent;base=p.parent
spec=[('source',0),('source',54),('slide',0),('slide',54),('return',0),('return',36)]
imgs={f'{clip}-{n}':cv2.imread(str(base/'mattes'/clip/'frames'/f'{n+1:04d}.png')) for clip,n in spec}
ref=imgs['source-0'];h,w=ref.shape[:2];yy,xx=np.indices((h,w));mask=((xx<730)|(xx>1420)|(yy>820)).astype(np.uint8)*255
sift=cv2.SIFT_create(nfeatures=6000);kr,dr=sift.detectAndCompute(cv2.cvtColor(ref,cv2.COLOR_BGR2GRAY),mask);matcher=cv2.BFMatcher();rows={}
for key,img in imgs.items():
 k,d=sift.detectAndCompute(cv2.cvtColor(img,cv2.COLOR_BGR2GRAY),mask);good=[m for m,n in matcher.knnMatch(d,dr,k=2) if m.distance<.7*n.distance];a=np.float32([k[m.queryIdx].pt for m in good]);b=np.float32([kr[m.trainIdx].pt for m in good]);mat,inl=cv2.estimateAffinePartial2D(a,b,method=cv2.RANSAC,ransacReprojThreshold=2,maxIters=10000);use=inl.ravel()>0
 # Fit scale and translation only on robust similarity inliers.
 aa=a[use];bb=b[use];A=np.zeros((len(aa)*2,3));A[::2,0]=aa[:,0];A[1::2,0]=aa[:,1];A[::2,1]=1;A[1::2,2]=1;s,tx,ty=np.linalg.lstsq(A,bb.reshape(-1),rcond=None)[0];M=np.array([[s,0,tx],[0,s,ty]]);err=np.linalg.norm(aa*s+[tx,ty]-bb,axis=1)
 aligned=cv2.warpAffine(img,M,(w,h));cv2.imwrite(str(p/f'{key}-registered.jpg'),aligned)
 rows[key]={'sourceToReference':[list(x) for x in M],'convention':'reference_xy = uniformScale * source_xy + translation; origin top left; no rotation or local warp','scale':s,'translation':[tx,ty],'featureMatches':len(good),'inliers':int(use.sum()),'medianResidualPixels':float(np.median(err)),'p95ResidualPixels':float(np.quantile(err,.95)),'similarityRotationDegrees':float(np.degrees(np.arctan2(mat[1,0],mat[0,0]))),'nativeDimensions':[w,h],'confidence':'background-feature fit; actor pose excluded'}
 # Draw feature fitting locations for evidence.
 ev=np.array(aligned);[cv2.circle(ev,tuple(np.round(pt).astype(int)),2,(0,255,255),-1) for pt in bb];cv2.imwrite(str(p/f'{key}-features.jpg'),ev)
for first,last,name in [('source-54','slide-0','pickup-slide'),('slide-54','return-0','slide-return'),('return-36','source-0','return-ready')]:
 a=Image.open(p/f'{first}-registered.jpg');b=Image.open(p/f'{last}-registered.jpg');out=Image.new('RGB',(1200,1000),'#222')
 for j,rect in enumerate([(850,75,1120,360),(810,460,1350,725)]):
  for i,im in enumerate([a,b]):out.paste(im.crop(rect).resize((600,450)),(i*600,j*500))
 ImageDraw.Draw(out).text((5,460),first+' -> '+last+'; registered to source0, crops independently enlarged',fill='white');out.save(p/f'{name}-pose.jpg')
receipt={'reference':'source native0','status':'camera registration only, no pose correction','sourceSha256':{c:hashlib.sha256((base/f'{c}.mp4').read_bytes()).hexdigest() for c in ['source','slide','return']},'backgroundMask':'x<730 or x>1420 or y>820; excludes actor and shoe','frames':rows};(p/'registration.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(rows,indent=2))
