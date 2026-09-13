from pathlib import Path
import cv2,numpy as np,json
p=Path(__file__).parent;s=p.parent.parent
names={'heldLast':p/'held-last.png','returnFirst':p/'return-01.png','transfer':s/'transfer-anchor.png','end':s/'end.png'}
ims={k:cv2.imread(str(v)) for k,v in names.items()}
report={'dimensions':{k:[a.shape[1],a.shape[0]] for k,a in ims.items()}}
a,b=ims['heldLast'],ims['returnFirst']
report['seam']={'rgbMAE':np.abs(a.astype(float)-b).mean(),'rgbMeanDelta':(b.astype(float)-a).mean((0,1))[::-1].tolist()}
# Fit similarity using stationary outer background; no body deformation.
def align(a,b):
 h,w=a.shape[:2];mask=np.zeros((h,w),np.uint8);mask[:int(h*.48),:int(w*.35)]=255;mask[:int(h*.48),int(w*.73):]=255
 orb=cv2.ORB_create(5000);ka,da=orb.detectAndCompute(a,mask);kb,db=orb.detectAndCompute(b,None)
 matches=cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(da,db,k=2);good=[m for m,n in matches if m.distance<.72*n.distance]
 src=np.float32([ka[m.queryIdx].pt for m in good]);dst=np.float32([kb[m.trainIdx].pt for m in good]);M,inliers=cv2.estimateAffinePartial2D(src,dst,method=cv2.RANSAC,ransacReprojThreshold=2)
 residual=np.linalg.norm(src@M[:,:2].T+M[:,2]-dst,axis=1)
 return {'matrix':M.tolist(),'inliers':int(inliers.sum()),'medianResidualPixels':float(np.median(residual[inliers[:,0]>0]))}
report['backgroundFits']={k:align(ims['returnFirst'],v) for k,v in ims.items()}
report['returnSamples']=[]
for n,f in enumerate(sorted(p.glob('return-*.png'))):
 im=cv2.imread(str(f));roi=im[770:900,880:1030];white=(roi.min(2)>150).astype(np.uint8);num,l,stats,cent=cv2.connectedComponentsWithStats(white)
 j=1+np.argmax(stats[1:,4]);x,y,w,h,area=stats[j];report['returnSamples'].append({'frame':n*18,'cardWhiteBBox':[int(x+880),int(y+770),int(w),int(h)],'centroid':[float(cent[j][0]+880),float(cent[j][1]+770)],'background':align(ims['returnFirst'],im)})
(p/'metrics.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
for label,frame,anchor in [('transfer-to-held-first','held-first.png','transfer'),('return-last-to-end','return-05.png','end')]:
 im=cv2.imread(str(p/frame));target=ims[anchor];scaled=cv2.resize(target,(im.shape[1],im.shape[0]),interpolation=cv2.INTER_LANCZOS4)
 report[label]={'rgbMAE_after_uniform_resize':float(np.abs(im.astype(float)-scaled).mean()),'meanRGBDelta':(im.astype(float)-scaled).mean((0,1))[::-1].tolist()}
(p/'metrics.json').write_text(json.dumps(report,indent=2))
