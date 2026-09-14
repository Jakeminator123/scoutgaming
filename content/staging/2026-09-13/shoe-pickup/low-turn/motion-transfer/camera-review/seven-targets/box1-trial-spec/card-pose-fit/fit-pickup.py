import sys;sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np,json,hashlib,shutil
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation
from pathlib import Path
from PIL import Image,ImageDraw
cv2.setNumThreads(1)
p=Path('/Users/solvifyab/Desktop/croupier/content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/camera-review/seven-targets/box1-trial-spec');o=p/'card-pose-fit';dense=json.loads((o/'trajectory18-63-proposal-v2.json').read_text());obj=np.array([[-31.5,-44,0],[31.5,-44,0],[31.5,44,0],[-31.5,44,0]],float);K=np.array([[1500.,0,960],[0,1500,540],[0,0,1]])
guess={9:[[1210,567],[1257,578],[1274,608],[1227,610]],10:[[1198,552],[1253,558],[1277,600],[1220,594]],11:[[1195,538],[1251,535],[1280,596],[1225,599]],12:[[1193,533],[1242,508],[1280,581],[1230,603]],13:[[1177,518],[1228,482],[1277,560],[1222,579]],14:[[1168,499],[1210,461],[1259,530],[1216,565]],15:[[1137,480],[1185,442],[1243,512],[1196,549]],16:[[1115,469],[1163,432],[1223,502],[1175,539]],17:[[1094,466],[1142,431],[1198,498],[1150,534]]}
edges={9:{1:[[1261,582],[1271,601]]},10:{1:[[1260,567],[1273,591]]},11:{1:[[1256,544],[1274,584]],3:[[1209,571],[1221,594]]},12:{1:[[1249,522],[1275,573]],3:[[1203,553],[1224,589]]},13:{1:[[1235,494],[1270,549]],3:[[1190,532],[1214,568]]},14:{1:[[1217,473],[1253,519]],2:[[1220,559],[1251,535]],3:[[1175,513],[1207,554]]},15:{1:[[1196,454],[1235,505]],2:[[1202,542],[1235,517]],3:[[1152,495],[1188,538]]},16:{1:[[1175,443],[1215,493]],2:[[1183,532],[1213,507]],3:[[1128,484],[1164,527]]},17:{1:[[1155,446],[1191,492]],2:[[1158,528],[1190,504]],3:[[1105,478],[1140,524]]}}
rows=[];prev=Rotation.from_rotvec(dense['frames'][0]['rvec'])
for n in range(17,8,-1):
 q=np.array(guess[n],float);lines={}
 for k,e in edges[n].items():l=np.cross([*e[0],1.],[*e[1],1.]);lines[k]=l/np.linalg.norm(l[:2])
 inferred=[0,2,3] if n<=13 else [0];unc=12 if n<=11 else 8 if n<=13 else 5
 def proj(v):return cv2.projectPoints(obj,v[:3],v[3:],K,None)[0].reshape(-1,2)
 def res(v):
  z=proj(v);rr=[]
  for k,l in lines.items():rr.extend((np.c_[z[[k,(k+1)%4]],np.ones(2)]@l/3.).tolist())
  for k in range(4):rr.extend(((z[k]-q[k])/(unc if k in inferred else 4)).tolist())
  return rr
 _,rv,tv,_=cv2.solvePnPGeneric(obj,q,K,None,flags=cv2.SOLVEPNP_IPPE);cs=[]
 for a,b in zip(rv,tv):
  fit=least_squares(res,np.r_[a.ravel(),b.ravel()],max_nfev=300);ang=np.linalg.norm((Rotation.from_rotvec(fit.x[:3]).inv()*prev).as_rotvec());score=np.mean(np.square(res(fit.x)))+.03*ang**2;cs.append((score,fit.x,ang))
 _,v,ang=min(cs,key=lambda x:x[0]);prev=Rotation.from_rotvec(v[:3]);z=proj(v);rows.append({'native':n,'pts':n/24,'quad':z.tolist(),'rvec':v[:3].tolist(),'tvec':v[3:].tolist(),'observedStraightEdges':edges[n],'inferredCornerIndices':inferred,'inferredCornerUncertaintyPx':unc,'observedBoundaryUncertaintyPx':4,'rotationToNextDeg':float(np.degrees(ang)),'status':'model-based pickup completion with substantial shoe/hand occlusion' if n<=13 else 'source-visible straight-edge constrained pickup fit','maskReady':False,'cardSideEvidence':'plain gray source surface9–10; source heart visible11+; not proof of a physical turnover'})
rows.sort(key=lambda x:x['native']);cap=cv2.VideoCapture(str(p/'source.mp4'));sheet=Image.new('RGB',(1500,760),(25,25,25));dr=ImageDraw.Draw(sheet)
for i,r in enumerate(rows):
 n=r['native'];cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,a=cap.read();q=np.array(r['quad']);cv2.polylines(a,[np.int32(q)],True,(0,255,0),1)
 for j,pt in enumerate(q):cv2.circle(a,tuple(np.int32(pt)),2,(0,165,255) if j in r['inferredCornerIndices'] else (0,255,0),-1)
 lo=np.floor(q.min(0)-15).astype(int);hi=np.ceil(q.max(0)+15).astype(int);im=Image.fromarray(cv2.cvtColor(a,cv2.COLOR_BGR2RGB)).crop((*lo,*hi));scale=min(290/im.width,320/im.height);im=im.resize((int(im.width*scale),int(im.height*scale)));xx=i%5*300;yy=i//5*380;sheet.paste(im,(xx,yy+28));dr.text((xx,yy+4),f'{n} inferred±{r["inferredCornerUncertaintyPx"]}px',fill='white')
sheet.save(o/'pickup9-17-pose-proof.jpg');(o/'pickup9-17-proposal.json').write_text(json.dumps({'status':'UNAPPROVED inferred pickup geometry, not measured hidden surface','sourceSHA256':dense['sourceSHA256'],'frames':rows},indent=2));shutil.copyfile(__file__,o/'fit-pickup.py');print([(r['native'],round(r['rotationToNextDeg'],1)) for r in rows])
