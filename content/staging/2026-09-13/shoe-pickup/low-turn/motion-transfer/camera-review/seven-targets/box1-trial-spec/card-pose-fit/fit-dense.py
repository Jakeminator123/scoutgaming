import sys;sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np,json,hashlib,shutil
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation,Slerp
from pathlib import Path
from PIL import Image,ImageDraw
cv2.setNumThreads(1)
p=Path('/Users/solvifyab/Desktop/croupier/content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/camera-review/seven-targets/box1-trial-spec');o=p/'card-pose-fit';kd=json.loads((o/'keyposes.json').read_text());keys={r['native']:r for r in kd['frames']};ks=np.array(list(keys));poses=[r['candidates'][r['selectedCandidate']] for r in keys.values()];rots=Slerp(ks,Rotation.from_rotvec([x['rvec'] for x in poses]));trans=np.array([x['tvec'] for x in poses]);obj=np.array([[-31.5,-44,0],[31.5,-44,0],[31.5,44,0],[-31.5,44,0]],float);K=np.array([[1500.,0,960],[0,1500,540],[0,0,1]]);cap=cv2.VideoCapture(str(p/'source.mp4'));rows=[];proof=Image.new('RGB',(1600,2160),(25,25,25));draw=ImageDraw.Draw(proof);n=0
while True:
 ok,a=cap.read()
 if not ok:break
 if n<18:n+=1;continue
 if n>63:break
 init=np.r_[rots(n).as_rotvec(),[np.interp(n,ks,trans[:,j]) for j in range(3)]]
 def project(v):return cv2.projectPoints(obj,v[:3],v[3:],K,None)[0].reshape(-1,2)
 guide=project(init);cx,cy=guide.mean(0);x0=max(0,int(cx-115));x1=min(1920,int(cx+115));y0=max(0,int(cy-95));y1=min(1080,int(cy+95));roi=a[y0:y1,x0:x1];m=((roi.min(2)>130)&(roi.max(2).astype(int)-roi.min(2).astype(int)<70)).astype(np.uint8)*255;contours,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);cs=[c for c in contours if cv2.contourArea(c)>200]
 if not cs:rows.append({'native':n,'status':'no paper contour'});n+=1;continue
 def score(c):
  mm=cv2.moments(c);cc=np.array([mm['m10']/mm['m00']+x0,mm['m01']/mm['m00']+y0]);return cv2.contourArea(c)/(1+np.linalg.norm(cc-[cx,cy])/40)
 cnt=max(cs,key=score).reshape(-1,2)+[x0,y0];hull=cv2.convexHull(cnt.astype(np.float32)).reshape(-1,2);center=hull.mean(0);delta=center-guide.mean(0);init[3:5]+=delta*init[5]/1500.;guide=project(init)
 poly=cv2.approxPolyDP(hull.astype(np.float32),1.5,True).reshape(-1,2);segments=[]
 for j in range(len(poly)):
  u=poly[j];v=poly[(j+1)%len(poly)];dv=v-u;length=np.linalg.norm(dv)
  if length<9:continue
  scores=[]
  for k in range(4):
   gd=guide[(k+1)%4]-guide[k];align=abs(np.dot(gd,dv)/(np.linalg.norm(gd)*length));line=np.cross([*u,1.],[*v,1.]);line/=np.linalg.norm(line[:2]);dist=abs(np.dot(np.r_[(guide[k]+guide[(k+1)%4])/2,1],line));scores.append((align,dist,k,line))
  align,dist,k,line=max(scores,key=lambda x:x[0]-.003*x[1])
  if align>.92 and dist<24:segments.append((k,line,u,v))
 def residual(z):
  q=project(z);rr=[]
  for k,line,u,v in segments:rr.extend((np.c_[q[[k,(k+1)%4]],np.ones(2)]@line/2.5).tolist())
  # Visible envelope must be covered; hidden fingers are not corner evidence.
  for pt in hull:
   sides=[]
   for j in range(4):
    ed=q[(j+1)%4]-q[j];vv=pt-q[j];sides.append((ed[0]*vv[1]-ed[1]*vv[0])/max(np.linalg.norm(ed),1))
   rr.append(max(0,-min(sides))/2.)
  rr.extend(((q-guide)/12.).ravel().tolist());return rr
 if n in keys:
  selected=keys[n]['candidates'][keys[n]['selectedCandidate']];fitv=np.r_[selected['rvec'],selected['tvec']];kind='manually observed straight-edge anchor'
 else:fit=least_squares(residual,init,max_nfev=100,loss='soft_l1',f_scale=2);fitv=fit.x;kind='source envelope and visible-line constrained rigid-pose proposal'
 q=project(fitv);outside=[]
 for pt in hull:
  sides=[]
  for j in range(4):
   ed=q[(j+1)%4]-q[j];vv=pt-q[j];sides.append((ed[0]*vv[1]-ed[1]*vv[0])/np.linalg.norm(ed))
  outside.append(max(0,-min(sides)))
 rows.append({'native':n,'pts':n/24,'quad':q.tolist(),'rvec':fitv[:3].tolist(),'tvec':fitv[3:].tolist(),'status':kind,'visiblePaperHull':hull.tolist(),'matchedVisibleSegments':[{'edge':k,'line':line.tolist(),'endpoints':[u.tolist(),v.tolist()]} for k,line,u,v in segments],'matchedSegmentCount':len(segments),'maxVisiblePaperOutsidePx':float(max(outside)),'inferredCornerUncertaintyPx':8 if len(segments)<3 else 5,'observedBoundaryUncertaintyPx':4,'maskReady':False})
 im=a.copy();cv2.polylines(im,[np.int32(q)],True,(0,255,0),1);lo=np.floor(np.minimum(q.min(0),hull.min(0))-12).astype(int);hi=np.ceil(np.maximum(q.max(0),hull.max(0))+12).astype(int);crop=Image.fromarray(cv2.cvtColor(im,cv2.COLOR_BGR2RGB)).crop((*lo,*hi));scale=min(190/crop.width,320/crop.height);crop=crop.resize((int(crop.width*scale),int(crop.height*scale)));i=n-18;xx=i%8*200;yy=i//8*360;proof.paste(crop,(xx,yy+22));draw.text((xx,yy+2),f'{n} out{max(outside):.1f} seg{len(segments)}',fill='white');n+=1
proof.save(o/'dense-source-quad-proof.jpg');(o/'trajectory18-63-proposal.json').write_text(json.dumps({'status':'UNAPPROVED source-constrained trajectory; requires dense visual audit and hand masks','sourceSHA256':kd['sourceSHA256'],'fps':24,'logicalCardSize':[63,88],'cameraAssumption':kd['cameraAssumption'],'method':'Each nativeframe remeasured against source neutral-paper envelope/straight edges; prior interpolation only initializes hidden pose. Raw opticalflow failed and is not trajectory source.','releaseNative':63,'frames':rows},indent=2));shutil.copyfile(__file__,o/'fit-dense.py');print('frames',len(rows),'maxoutside',max(r.get('maxVisiblePaperOutsidePx',999) for r in rows),'weak',[r['native'] for r in rows if r.get('matchedSegmentCount',0)<2])
