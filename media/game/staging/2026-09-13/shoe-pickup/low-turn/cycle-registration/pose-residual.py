from pathlib import Path
import sys,json
import numpy as np
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2
p=Path(__file__).resolve().parent;out={}
for fr,to in [('source-54','slide-0'),('slide-54','return-0'),('return-36','source-0')]:
 a=cv2.imread(str(p/f'{fr}-registered.jpg'),0);b=cv2.imread(str(p/f'{to}-registered.jpg'),0);out[fr+'->'+to]={}
 for name,(x,y,w,h) in {'eyes':(910,140,130,80),'face':(900,115,155,165),'viewerLeftHand':(910,500,220,160),'viewerRightHand':(1120,525,160,150)}.items():
  mask=np.zeros_like(a);mask[y:y+h,x:x+w]=255;pts=cv2.goodFeaturesToTrack(a,150,.025,5,mask=mask);q,st,err=cv2.calcOpticalFlowPyrLK(a,b,pts,None,winSize=(21,21),maxLevel=3);back,s2,e2=cv2.calcOpticalFlowPyrLK(b,a,q,None,winSize=(21,21),maxLevel=3);keep=(st.ravel()>0)&(s2.ravel()>0)&(np.linalg.norm((back-pts).reshape(-1,2),axis=1)<1)&(err.ravel()<35);v=(q-pts).reshape(-1,2)[keep];out[fr+'->'+to][name]={'validTracks':int(len(v)),'medianDisplacementXY':np.median(v,axis=0).tolist() if len(v) else None,'medianDistancePixels':float(np.median(np.linalg.norm(v,axis=1))) if len(v) else None,'p95DistancePixels':float(np.quantile(np.linalg.norm(v,axis=1),.95)) if len(v) else None,'method':'forward-backward consistent sparse optical flow after static-background registration; appearance features, not anatomical landmarks'}
(p/'pose-residual.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
