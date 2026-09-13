from pathlib import Path
import cv2,numpy as np,json
p=Path(__file__).parent
pairs=[('extract-to-turn',p/'extract-edge-02.png',p/'edge-face-01.png'),('turn-to-slide',p/'edge-face-02.png',p.parent/'seams/held-first.png'),('return-to-extract',p.parent/'seams/return-05.png',p/'extract-edge-01.png')]
out=[]
for name,pa,pb in pairs:
 a,b=cv2.imread(str(pa)),cv2.imread(str(pb));h,w=a.shape[:2]
 mask=np.zeros((h,w),np.uint8);mask[:int(h*.47),:int(w*.35)]=255;mask[:int(h*.47),int(w*.73):]=255
 orb=cv2.ORB_create(6000);ka,da=orb.detectAndCompute(a,mask);kb,db=orb.detectAndCompute(b,None)
 matches=cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(da,db,k=2);good=[m for m,n in matches if m.distance<.72*n.distance]
 x=np.float32([ka[m.queryIdx].pt for m in good]);y=np.float32([kb[m.trainIdx].pt for m in good]);M,ins=cv2.estimateAffinePartial2D(x,y,method=cv2.RANSAC,ransacReprojThreshold=2)
 bb=cv2.warpAffine(b,cv2.invertAffineTransform(M),(w,h));res=np.linalg.norm(x@M[:,:2].T+M[:,2]-y,axis=1)
 regions={'face':(.47,.06,.535,.235),'body':(.395,.24,.59,.48),'shoe':(.65,.445,.71,.605)};rois={}
 for label,(x0,y0,x1,y1) in regions.items():
  aa=a[int(y0*h):int(y1*h),int(x0*w):int(x1*w)];br=bb[int(y0*h):int(y1*h),int(x0*w):int(x1*w)]
  shift,confidence=cv2.phaseCorrelate(cv2.cvtColor(aa,cv2.COLOR_BGR2GRAY).astype(np.float32),cv2.cvtColor(br,cv2.COLOR_BGR2GRAY).astype(np.float32))
  rois[label]={'residualShiftPixels':list(shift),'phaseCorrelationResponse':confidence,'rgbMAE':float(np.abs(aa.astype(float)-br).mean())}
 out.append({'name':name,'dimensionsA':[w,h],'dimensionsB':[b.shape[1],b.shape[0]],'similarity_A_to_B':M.tolist(),'backgroundInliers':int(ins.sum()),'backgroundMedianResidual':float(np.median(res[ins[:,0]>0])),'regions_after_global_alignment':rois})
 cv2.imwrite(str(p/(name+'-aligned-B.png')),bb)
(p/'metrics.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
