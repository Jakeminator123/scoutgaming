"""Measure rigid actor registration and a fixed per-take RGB balance.
No local facial warps: only one uniform scale, x/y translation and RGB gains.
"""
import cv2,json,numpy as np
from pathlib import Path
HERE=Path(__file__).resolve().parent;REPO=HERE.parents[3];PUB=REPO/'web/public';W,H=960,760
cv2.setNumThreads(1)
def read(path,n=0,dy=0):
 v=cv2.VideoCapture(str(path));v.set(1,n);ok,b=v.read();v.release();assert ok,path
 h=b.shape[0]//2;w=b.shape[1];a=np.zeros((H,W,4),np.uint8);a[:h,:w,:3]=cv2.cvtColor(b[:h],cv2.COLOR_BGR2RGB);a[:h,:w,3]=b[h:,:,0]
 return cv2.warpAffine(a,np.float32([[1,0,0],[0,1,dy]]),(W,H))
saved=json.loads((HERE/'inputs.json').read_text()) if (HERE/'inputs.json').exists() else None
idle=saved['idle'] if saved else json.loads((PUB/'review/astrid-green-waiting/idle.json').read_text())
ref=read(PUB/idle['base']['src']);mask=np.zeros((H,W),np.uint8);mask[55:245,300:510]=255
sift=cv2.SIFT_create();kr,dr=sift.detectAndCompute(cv2.cvtColor(ref[:,:,:3],cv2.COLOR_RGB2GRAY),mask)
def fit(a):
 k,d=sift.detectAndCompute(cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2GRAY),mask)
 matches=cv2.BFMatcher().knnMatch(d,dr,k=2);good=[m for m,n in matches if m.distance<.75*n.distance]
 src=np.float32([k[m.queryIdx].pt for m in good]);dst=np.float32([kr[m.trainIdx].pt for m in good]);_,inside=cv2.estimateAffinePartial2D(src,dst,method=cv2.RANSAC,ransacReprojThreshold=2)
 sel=inside.ravel()>0;src=src[sel];dst=dst[sel];c=src.mean(0);q=dst.mean(0);s=((src-c)*(dst-q)).sum()/((src-c)**2).sum();off=q-s*c
 return {'scale':float(s),'offset':off.tolist(),'matches':len(src),'medianResidual':float(np.median(np.linalg.norm(src*s+off-dst,axis=1)))}
def transform(a,cal):
 s=cal['scale'];x,y=cal['offset'];b=cv2.warpAffine(a,np.float32([[s,0,x],[0,s,y]]),(W,H));b[:,:,:3]=np.uint8(np.clip(b[:,:,:3].astype(float)*cal.get('gain',[1,1,1]),0,255));return b
face=np.zeros((H,W),bool);face[95:222,345:485]=True
r=ref[:,:,:3].astype(float)
def skin(a):
 c=a[:,:,:3].astype(float)
 return (a[:,:,3]>250)&(c[:,:,0]>c[:,:,1]+16)&(c[:,:,1]>c[:,:,2]+9)&(c[:,:,0]>115)&(c[:,:,0]<235)&(c[:,:,2]>65)
reference_skin=face&skin(ref)
def grade(a):
 sel=reference_skin&skin(a);sel=cv2.erode(sel.astype(np.uint8),np.ones((3,3),np.uint8))>0
 # Compare corresponding diffuse skin, robustly downweighting expression/texture differences.
 sm=cv2.GaussianBlur(a[:,:,:3].astype(float),(9,9),2);rm=cv2.GaussianBlur(r,(9,9),2)
 gain=np.median((rm[sel]+1)/(sm[sel]+1),axis=0);return np.clip(gain,.8,1.2).tolist()
def measure(frames):
 fits=[fit(a) for a in frames];s=float(np.median([f['scale'] for f in fits]));off=np.median([f['offset'] for f in fits],axis=0).tolist();cal={'scale':s,'offset':off}
 # Measure gain after each endpoint's exact alignment; don't confuse pose with illumination.
 cal['gain']=np.median([grade(transform(a,f)) for a,f in zip(frames,fits)],axis=0).tolist();cal['samples']=fits
 return cal
if __name__=='__main__':
 speak=saved['speak'] if saved else json.loads((PUB/'review/astrid-green-speak/speak.json').read_text());out={}
 for name,src,nums,dy in [('rest',idle['rest']['loop']['src'],[0,24,48,72],0),('bridge',idle['rest']['out']['src'],[6,24,40,62],0),('glances',idle['glances']['src'],[0,41,90,120],15.3)]:
  frames=[read(PUB/src,n,dy) for n in nums];out[name]=measure(frames);print(name,json.dumps(out[name]),flush=True)
 for name,line in speak['lines'].items():
  out[name]=measure([read(PUB/line['media']['src'],n,20) for n in [0,line['media']['frames']-1]]);print(name,json.dumps(out[name]),flush=True)
 (HERE/'calibration.json').write_text(json.dumps(out,indent=2)+'\n')
