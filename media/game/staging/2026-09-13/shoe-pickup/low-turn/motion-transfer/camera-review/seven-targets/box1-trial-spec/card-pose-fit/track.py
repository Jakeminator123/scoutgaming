import sys;sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np,json,hashlib,shutil
from pathlib import Path
cv2.setNumThreads(1)
p=Path('/Users/solvifyab/Desktop/croupier/content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/camera-review/seven-targets/box1-trial-spec');o=p/'card-pose-fit';d=json.loads((o/'keyposes.json').read_text());keys={r['native']:np.array(r['amodalQuad'],np.float32) for r in d['frames']};cap=cv2.VideoCapture(str(p/'source.mp4'));frames={};n=0
while True:
 ok,a=cap.read()
 if not ok:break
 if 18<=n<=63:frames[n]=a
 n+=1
allrows=[];intervals=[]
for start,end in zip(list(keys)[:-1],list(keys)[1:]):
 q=keys[start].copy();rows=[]
 for n in range(start,end):
  a=frames[n];b=frames[n+1];ga=cv2.cvtColor(a,cv2.COLOR_BGR2GRAY);gb=cv2.cvtColor(b,cv2.COLOR_BGR2GRAY);m=np.zeros(ga.shape,np.uint8);cv2.fillPoly(m,[np.int32(q)],255);m=cv2.erode(m,np.ones((3,3),np.uint8));neutral=(a.min(2)>100)&(a.max(2).astype(int)-a.min(2).astype(int)<60);m[~neutral]=0;pts=cv2.goodFeaturesToTrack(ga,maxCorners=80,qualityLevel=.01,minDistance=3,mask=m,blockSize=3)
  if pts is None or len(pts)<4:rows.append({'from':n,'to':n+1,'status':'insufficient paper features','count':0 if pts is None else len(pts)});break
  dst,st,err=cv2.calcOpticalFlowPyrLK(ga,gb,pts,None,winSize=(25,25),maxLevel=4,criteria=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,40,.005));back,st2,err2=cv2.calcOpticalFlowPyrLK(gb,ga,dst,None,winSize=(25,25),maxLevel=4,criteria=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,40,.005));fb=np.linalg.norm(back-pts,axis=2).ravel();good=(st.ravel()>0)&(st2.ravel()>0)&(fb<1.5);sp=pts.reshape(-1,2)[good];tp=dst.reshape(-1,2)[good]
  if len(sp)<4:rows.append({'from':n,'to':n+1,'status':'insufficient FB-consistent tracks','count':len(sp)});break
  H,inl=cv2.findHomography(sp,tp,cv2.RANSAC,2.);cnt=int(inl.sum()) if inl is not None else 0
  if H is None or cnt<4:rows.append({'from':n,'to':n+1,'status':'homography rejected','count':cnt});break
  nq=cv2.perspectiveTransform(q.reshape(1,4,2),H).reshape(4,2);ar0=abs(cv2.contourArea(q));ar1=abs(cv2.contourArea(nq));ratio=ar1/max(ar0,1);valid=np.isfinite(nq).all() and .6<ratio<1.6
  if not valid:rows.append({'from':n,'to':n+1,'status':'area/finite guard rejected','ratio':ratio,'inliers':cnt});break
  rows.append({'from':n,'to':n+1,'status':'tracked source features','inliers':cnt,'totalGood':len(sp),'fbMedianPx':float(np.median(fb[good])),'quad':nq.tolist(),'trackedPoints':tp[inl.ravel()>0].tolist()});q=nq
 complete=len(rows)==end-start and all(r['status']=='tracked source features' for r in rows);res=np.linalg.norm(q-keys[end],axis=1).tolist() if complete else None;intervals.append({'start':start,'end':end,'complete':complete,'endpointCornerResidualPx':res,'rows':rows});print(start,end,complete,res, rows[-1]['status'])
(o/'tracking-validation.json').write_text(json.dumps({'status':'tracking evidence only, not accepted interpolation','sourceSHA256':d['sourceSHA256'],'method':'source-neutral paper features, pyramidalLK forward/back consistency1.5px, per-step homographyRANSAC2px; rejects missing/degenerate tracks','intervals':intervals},indent=2));shutil.copyfile(__file__,o/'track.py')
