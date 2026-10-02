import cv2,json,numpy as np
from pathlib import Path
from PIL import Image,ImageDraw
HERE=Path(__file__).resolve().parent;PUB=HERE.parents[3]/'web/public';W,H=960,760
saved=json.loads((HERE/'inputs.json').read_text());idle=saved['idle'];speak=saved['speak']
def frame(src,n=0,dy=0):
 v=cv2.VideoCapture(str(PUB/src));v.set(1,n);ok,b=v.read();v.release();assert ok
 h=b.shape[0]//2;w=b.shape[1];a=np.zeros((H,W,4),np.uint8);a[:h,:w,:3]=cv2.cvtColor(b[:h],cv2.COLOR_BGR2RGB);a[:h,:w,3]=b[h:,:,0]
 return cv2.warpAffine(a,np.float32([[1,0,0],[0,1,dy]]),(W,H))
ref=frame(idle['base']['src']);mask=np.zeros((H,W),np.uint8);mask[55:245,300:510]=255
sift=cv2.SIFT_create();kr,dr=sift.detectAndCompute(cv2.cvtColor(ref[:,:,:3],cv2.COLOR_RGB2GRAY),mask)
def fit(a):
 k,d=sift.detectAndCompute(cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2GRAY),mask)
 matches=cv2.BFMatcher().knnMatch(d,dr,k=2);good=[m for m,n in matches if m.distance<.75*n.distance]
 src=np.float32([k[m.queryIdx].pt for m in good]);dst=np.float32([kr[m.trainIdx].pt for m in good]);mat,inside=cv2.estimateAffinePartial2D(src,dst,method=cv2.RANSAC,ransacReprojThreshold=2)
 sel=inside.ravel()>0;src=src[sel];dst=dst[sel]
 # Similarity fit with no rotation: fixed source scale and translation only.
 c=src.mean(0);q=dst.mean(0);s=((src-c)*(dst-q)).sum()/((src-c)**2).sum();off=q-s*c
 mat=np.float32([[s,0,off[0]],[0,s,off[1]]]);err=np.linalg.norm(src*s+off-dst,axis=1)
 return mat,{'scale':float(s),'offset':off.tolist(),'matches':len(src),'medianResidual':float(np.median(err))}
def skin(a):
 rgb=a[80:245,325:490,:3].astype(float);m=(rgb[:,:,0]>rgb[:,:,1]+10)&(rgb[:,:,1]>rgb[:,:,2]+10)&(rgb[:,:,0]>110)&(rgb[:,:,2]>55)&(rgb[:,:,0]<240)
 return np.median(rgb[m],axis=0).tolist()
items=[('ready',ref),('rest-start',frame(idle['rest']['loop']['src'])),('rest-end',frame(idle['rest']['loop']['src'],72)),('bridge-middle',frame(idle['rest']['out']['src'],36)),('glance-ready',frame(idle['glances']['src'],0,15.3)),('speech-greeting',frame(speak['lines']['greeting']['media']['src'],0,20)),('speech-goodluck',frame(speak['lines']['goodluck']['media']['src'],0,20))]
report={};sheet=Image.new('RGB',(len(items)*250,395),'#222');draw=ImageDraw.Draw(sheet)
for i,(name,a) in enumerate(items):
 mat,metrics=fit(a);metrics['skinMedian']=skin(a);report[name]=metrics
 rgb=np.uint8(a[:,:,:3]*(a[:,:,3:4]/255)+35*(1-a[:,:,3:4]/255));im=Image.fromarray(rgb).crop((275,20,550,350)).resize((250,300));sheet.paste(im,(i*250,55));draw.text((i*250+3,3),name,fill='white');draw.text((i*250+3,23),f"scale {metrics['scale']:.4f}",fill='white')
(HERE/'before-measurements.json').write_text(json.dumps(report,indent=2)+'\n');sheet.save(HERE/'before-compare.jpg',quality=94);print(json.dumps(report,indent=2))
