import sys;sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np,json,hashlib,itertools
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation
from pathlib import Path
from PIL import Image,ImageDraw
cv2.setNumThreads(1)
p=Path('/Users/solvifyab/Desktop/croupier/content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/camera-review/seven-targets/box1-trial-spec');o=p/'card-pose-fit';o.mkdir(exist_ok=True)
# Edges ordered top,right,bottom,left; straight visible interior segments exclude rounded corners and fingers.
edge={18:[None,[[1128,445],[1164,493]],[[1130,526],[1163,507]],[[1081,479],[1115,523]]],30:[None,[[1039,563],[1050,577]],[[1008,578],[1044,579]],[[975,548],[995,573]]],40:[[[998,614],[1036,605]],[[1059,616],[1064,630]],[[1019,651],[1059,637]],[[993,624],[1003,646]]],48:[[[757,675],[783,677]],[[828,710],[833,734]],[[762,737],[819,741]],[[744,689],[752,728]]],63:[[[576,701],[632,722]],[[639,733],[621,782]],[[549,770],[603,789]],[[542,756],[562,705]]]}
guess={18:[[1073,466],[1120,436],[1171,503],[1123,532]],30:[[970,540],[1015,532],[1053,580],[1000,580]],40:[[990,616],[1054,601],[1068,636],[1011,657]],48:[[741,673],[824,680],[835,742],[753,738]],63:[[565,696],[644,724],[618,794],[536,766]]}
obj=np.array([[-31.5,-44,0],[31.5,-44,0],[31.5,44,0],[-31.5,44,0]],float);K=np.array([[1500.,0,960],[0,1500,540],[0,0,1]])
rows=[];cap=cv2.VideoCapture(str(p/'source.mp4'));proof=Image.new('RGB',(1500,730),(25,25,25));dr=ImageDraw.Draw(proof)
for col,n in enumerate(edge):
 lines=[]
 for e in edge[n]:
  if e is None:lines.append(None);continue
  l=np.cross([*e[0],1.],[*e[1],1.]);lines.append(l/np.linalg.norm(l[:2]))
 q=np.array(guess[n],float);inferred=[]
 for j in range(4):
  a,b=lines[j-1],lines[j]
  if a is not None and b is not None:
   h=np.cross(a,b);q[j]=h[:2]/h[2]
  else:inferred.append(j)
 def project(v):return cv2.projectPoints(obj,v[:3],v[3:],K,None)[0].reshape(-1,2)
 def residual(v):
  out=[];z=project(v)
  for j,l in enumerate(lines):
   if l is not None:out.extend((np.c_[z[[j,(j+1)%4]],np.ones(2)]@l/2.).tolist())
  for j in range(4):out.extend(((z[j]-q[j])/(12 if j in inferred else 3)).tolist())
  return out
 ret,rvecs,tvecs,errors=cv2.solvePnPGeneric(obj,q,K,None,flags=cv2.SOLVEPNP_IPPE);candidates=[]
 for rv,tv in zip(rvecs,tvecs):
  fit=least_squares(residual,np.r_[rv.ravel(),tv.ravel()],max_nfev=500);z=project(fit.x);rot=cv2.Rodrigues(fit.x[:3])[0];candidates.append({'rvec':fit.x[:3].tolist(),'tvec':fit.x[3:].tolist(),'quad':z.tolist(),'normal':rot[:,2].tolist(),'fitRMS':float(np.sqrt(np.mean(np.square(residual(fit.x))))),'cornerDeltaPx':np.linalg.norm(z-q,axis=1).tolist()})
 rows.append({'native':n,'straightEdgeSegments':edge[n],'lineIntersectionQuad':q.tolist(),'inferredCornerIndices':inferred,'cornerNotes':['hidden top corner inferred from prior and rigid-pose constraint; not observed' if j in inferred else 'intersection of observed straight edge lines; rounded physical corner inferred' for j in range(4)],'sourceBoundaryUncertaintyPx':4,'candidates':candidates})
 cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,img=cap.read();bb=np.array(guess[n]);x0=int(bb[:,0].min()-25);y0=int(bb[:,1].min()-30);x1=int(bb[:,0].max()+25);y1=int(bb[:,1].max()+30)
 for row,im in enumerate([img.copy(),img.copy()]):
  if row:
   z=np.array(candidates[0]['quad']);cv2.polylines(im,[np.int32(z)],True,(0,255,0),1)
   for j,pt in enumerate(z):cv2.circle(im,tuple(np.int32(pt)),3,(0,165,255) if j in inferred else (0,255,0),-1)
  crop=Image.fromarray(cv2.cvtColor(im,cv2.COLOR_BGR2RGB)).crop((x0,y0,x1,y1));crop.thumbnail((300,310));proof.paste(crop,(col*300,row*350+35));dr.text((col*300,row*350+5),f'{n} '+('source' if row==0 else 'candidate0; orange=inferred'),fill='white')
# Choose continuous branch across keys, not per-frame minimum alone.
best=None
for inds in itertools.product(range(2),repeat=len(rows)):
 cs=[rows[i]['candidates'][j] for i,j in enumerate(inds)];angles=[np.linalg.norm((Rotation.from_rotvec(cs[i]['rvec']).inv()*Rotation.from_rotvec(cs[i+1]['rvec'])).as_rotvec()) for i in range(len(cs)-1)];score=sum(c['fitRMS']**2 for c in cs)+.03*sum(a*a for a in angles)
 if best is None or score<best[0]:best=(score,inds,angles)
for i,j in enumerate(best[1]):rows[i]['selectedCandidate']=j;rows[i]['amodalQuad']=rows[i]['candidates'][j]['quad']
proof.save(o/'key-source-quad-proof.jpg');(o/'keyposes.json').write_text(json.dumps({'status':'UNAPPROVED five-key rigid-pose proposal; hidden corners explicitly inferred','sourceSHA256':hashlib.sha256((p/'source.mp4').read_bytes()).hexdigest(),'cameraAssumption':{'focalPx':1500,'principal':[960,540],'calibrated':False},'cardLogicalSize':[63,88],'physicalDimensionsMeasured':False,'cornerOrder':'TL,TR,BR,BL by hypothesized printed-card orientation','branchSelection':{'indices':best[1],'rotationStepsDeg':np.degrees(best[2]).tolist(),'note':'Continuity preference only; intermediate motion not yet tracked'},'frames':rows},indent=2));print([(r['native'],r['selectedCandidate'],r['candidates'][r['selectedCandidate']]['fitRMS'],r['candidates'][r['selectedCandidate']]['cornerDeltaPx']) for r in rows])
