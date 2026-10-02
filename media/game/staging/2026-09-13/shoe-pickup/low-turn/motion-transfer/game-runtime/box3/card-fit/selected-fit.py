from pathlib import Path
exec((Path('/Users/solvifyab/Desktop/croupier/content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/game-runtime/box3/card-fit')/'box3-plane-fit.py').read_text().split('rows=[]')[0])
import hashlib
from scipy.spatial import cKDTree
pacep=o.parent/'pace/receipt.json';pace=json.load(open(pacep));keys=json.load(open(o/'keypose-fixed-plane.json'))['records'];kn=np.array([z['frame'] for z in keys]);kv=np.array([[z['theta'],*z['center']] for z in keys]);cap=cv2.VideoCapture(str(r/'content/staging/2026-09-09/contact-proof/source.mp4'));records=[];proof=[]
def edges(q):return np.concatenate([q[i]+np.linspace(0,1,100)[:,None]*(q[(i+1)%4]-q[i]) for i in range(4)])
for f in pace['frames']:
 n=f['sourceNative'];row={'outputFrame':f['outputFrame'],'sourceNative':n,'cornersNative':None,'confidence':'hidden','evidence':'entry/pre-extraction no observed card','inferredHiddenCorners':[],'residual':None}
 if n is not None and n>=38:
  v=np.array([np.interp(min(n,92),kn,kv[:,i]) for i in range(3)]);cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,x=cap.read();q0=quad(v);points=np.empty((0,2));res=None
  if 49<=n<92:
   mask=cv2.inRange(x,np.array([140,165,180]),np.array([245,255,255]));roi=np.zeros_like(mask);lo=np.floor(q0.min(0)-12).astype(int);hi=np.ceil(q0.max(0)+12).astype(int);roi[max(0,lo[1]):hi[1],max(0,lo[0]):hi[0]]=255;mask &=roi
   cc,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
   if cc:
    ct=max(cc,key=cv2.contourArea)[:,0].astype(float);dist=cKDTree(edges(q0)).query(ct)[0];points=ct[dist<18]
    if len(points)>20:
     def fun(z):return cKDTree(edges(quad(z))).query(points)[0]
     fit=least_squares(fun,v,bounds=(v-[.55,22,22],v+[.55,22,22]),loss='soft_l1',f_scale=1.8,max_nfev=70);v=fit.x;res=float(np.sqrt(np.mean(fun(v)**2)))
  q=quad(v);row.update(cornersNative=q.tolist(),pose={'theta':float(v[0]),'center':v[1:].tolist()},confidence='low' if n<49 else 'medium',evidence='inferred from bounding keyposes; rear hidden by shoe; visually checked candidate only' if n<49 else ('terminal fixed pose from92; stationary source paper' if n>=92 else 'estimated least-squares fixed-basis fit to colour-selected contour samples near initialized paper boundary; not manual measured corners'),inferredHiddenCorners=[0,1,2,3] if n<49 else ['hand-occluded corner positions inferred from fixed dimensions'],residual={'boundarySampleRMSPixels':res,'selectedSamples':len(points),'notAmOdalCornerMeasurement':True},needsShoeOcclusion=n<50)
  if n<=92:
   im=Image.fromarray(cv2.cvtColor(x,cv2.COLOR_BGR2RGB));d=ImageDraw.Draw(im);qq=[tuple(z) for z in q];d.line(qq+[qq[0]],fill='cyan',width=2)
   for pt in points[::5]:d.ellipse((pt[0]-1,pt[1]-1,pt[0]+1,pt[1]+1),fill='red')
   crop=im.crop((880,570,1360,900)).resize((640,440));proof.append((f['outputFrame'],n,crop))
 records.append(row)
for page in range((len(proof)+5)//6):
 sh=Image.new('RGB',(1920,960),(20,20,20))
 for k,(f,n,im) in enumerate(proof[page*6:page*6+6]):
  sh.paste(im,((k%3)*640,(k//3)*480+25));ImageDraw.Draw(sh).text(((k%3)*640,(k//3)*480),f'output{f} native{n} ESTIMATED no flip',fill='white')
 sh.save(o/f'selected-proof-{page}.jpg',quality=94)
(o/'selected-output-tracking.json').write_text(json.dumps({'status':'staging fitted proposal pending parent fullsubset review','originalSourceSHA256':'fdc1edca5671b88ccee6906746614c15b1e2b26bdabc83342b8505e0c97272c9','paceReceiptSHA256':hashlib.sha256(pacep.read_bytes()).hexdigest(),'basis':A.tolist(),'physicalDimensionClaim':False,'fps':60,'frames':records},indent=2));print(len(proof),[(z['sourceNative'],z['residual']) for z in records if z['cornersNative'] is not None][:25])
