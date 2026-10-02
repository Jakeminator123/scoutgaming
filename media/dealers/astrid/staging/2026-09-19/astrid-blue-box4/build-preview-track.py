"""Complete an explicitly provisional track for Kevin's live experiment.
Known 72x103mm rigid geometry; body fits before the turn, marker fits after.
"""
import json, math
from pathlib import Path
import cv2, numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation, Slerp
D=Path(__file__).resolve().parent
T=json.loads((D/'target.json').read_text())
E=json.loads((D/'source-review/evidence.json').read_text())
L=json.loads((D/'source-review/rigid-fit.json').read_text())
P=np.array(T['camera']['projection']).reshape(4,4,order='F');W=np.array(T['camera']['world']).reshape(4,4,order='F');VP=P@np.linalg.inv(W)
w,h=T['cardSizeMetres'];surface=T['quadWorld'][0][1]
local=np.array([[-w/2,0,-h/2],[w/2,0,-h/2],[w/2,0,h/2],[-w/2,0,h/2]])
M=np.array([[960,0,960],[0,-540,540],[0,0,1]])
H=M@VP[[0,1,3]][:,[0,2,3]];H[:,2]+=M@VP[[0,1,3],1]*surface;Hi=np.linalg.inv(H)
def table(p):
 a=Hi@np.r_[p,1];return a[:2]/a[2]
def world(p):return local@cv2.Rodrigues(np.asarray(p[3:]))[0].T+[p[0],surface+p[2],p[1]]
def project(p):
 a=np.c_[world(p),np.ones(4)]@VP.T;return np.c_[(a[:,0]/a[:,3]+1)*960,(1-a[:,1]/a[:,3])*540]
poses={f['frame']:np.array(f['pose']) for f in L['frames']}
previous=None;residuals={}
for n in range(28):
 f=E['frames'][n];b=max(f['blueBodies'],key=lambda b:b['pixels'])
 rect=cv2.boxPoints(cv2.minAreaRect(np.array(b['hull'],np.float32)))
 # Blue outline is partial near the shoe/fingers. This is a bounded rigid
 # approximation, never represented as a measured four-marker solution.
 centre=table(np.array(b['centre']));best=None
 for k in range(4):
  q=np.roll(rect,k,axis=0)
  v=table(q[1])-table(q[0]);yaw=-math.atan2(v[1],v[0])
  initial=np.array([*centre,.025,.3,yaw,0])
  initial[4]=(initial[4]+math.pi)%(2*math.pi)-math.pi
  def err(p):
   boundary=(project(p)-q).ravel()
   return np.r_[boundary,(p[2]-.04)*8]
  fit=least_squares(err,initial,bounds=([-.6,-.3,0,-3.14,-3.15,-3.14],[.7,.8,.25,3.14,3.15,3.14]),loss='soft_l1',f_scale=4,max_nfev=100)
  score=np.linalg.norm(err(fit.x))
  if previous is not None:score+=.03*np.linalg.norm(project(fit.x)-project(previous))
  if best is None or score<best[0]:best=(score,fit.x)
 poses[n]=best[1];residuals[n]=best[0];previous=best[1]

# The short ambiguous turn follows a rigid orientation interpolation. Mark
# every interpolated corner inferred; it is not camera-measured motion.
a,b=27,31
ra=Rotation.from_rotvec(poses[a][3:]);rb=Rotation.from_rotvec(poses[b][3:])
slerp=Slerp([a,b],Rotation.from_quat([ra.as_quat(),rb.as_quat()]))
for n in range(a+1,b):
 u=(n-a)/(b-a);poses[n]=np.r_[poses[a][:3]*(1-u)+poses[b][:3]*u,slerp([n]).as_rotvec()[0]]
# Keep the stationary landed pose exact. It already matches the ordinary
# Box4 first-card area; no chip or betting box has been moved.
for n in range(55,97):poses[n]=poses[96].copy()
frames=[]
for n in range(97):
 q=project(poses[n]);method='inferred-rigid-body-fit' if n<28 else 'inferred-rigid-turn' if n<31 else 'rigid-marker-fit-with-temporal-prior' if n<44 else 'fixed-size-table-plane'
 frames.append({'frame':n,'quad':q.tolist(),'faceUp':n>=29,'pose':poses[n].tolist(),'method':method,'confidence':.35 if n<31 else .6 if n<44 else .85,'inferredCorners':[0,1,2,3] if n<44 else [0] if n<56 else []})
result={'sourceSha256':E['summary']['sourceSha256'],'jobId':'c01866d1-7c93-43a4-9493-73f7c66d3725','frameCount':97,'fps':24,'scaleFitted':False,'cardSizeMetres':[w,h],
 'authoredEvents':{'pickup':0,'release':55,'land':56,'rest':96},'frames':frames,
 'limits':['User explicitly requested a live experiment after source rejection; this is not accepted choreography.',
 'Frames0-27 use partial blue-body outline fits, not marker-proven pose. Blue prop begins exposed in shoe.',
 'Frames28-30 use rigid temporal interpolation through missing thin-edge evidence; face flip at29 is inferred between visible back and front.',
 'Lifted marker poses remain underconstrained and show an edge mismatch near43.',
 'Fixed72x103mm geometry throughout; no per-frame scale or actor warp.',
 'Source uses one hand without transfer, pauses upright, and releases around2.29s. Original24fps timing retained.']}
(D/'preview-track.json').write_text(json.dumps(result,indent=2)+'\n')
tiles=[]
from PIL import Image,ImageDraw
for n in [0,8,20,22,24,26,27,28,29,30,31,44]:
 im=cv2.imread(str(D/'source-review/frames'/f'{n:04}.png'));q=np.rint(frames[n]['quad']).astype(np.int32)
 cv2.polylines(im,[q],True,(0,165,255),2,cv2.LINE_AA)
 tile=Image.new('RGB',(500,300),'#15191c');small=Image.fromarray(cv2.cvtColor(im[470:800,900:1450],cv2.COLOR_BGR2RGB));small.thumbnail((500,270));tile.paste(small,(0,30));ImageDraw.Draw(tile).text((8,8),f'Frame {n}: provisional rigid track',fill='white');tiles.append(tile)
sheet=Image.new('RGB',(1500,1200),'#15191c')
for j,t in enumerate(tiles):sheet.paste(t,((j%3)*500,(j//3)*300))
sheet.save(D/'preview-track.jpg',quality=92)
print(json.dumps({'frames':97,'fixedCardSize':[w,h],'scope':'review only','quadBounds':[float(min(np.array(f['quad'])[:,0].min() for f in frames)),float(max(np.array(f['quad'])[:,0].max() for f in frames))]}))
