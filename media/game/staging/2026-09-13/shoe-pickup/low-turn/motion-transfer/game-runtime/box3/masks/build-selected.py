import sys;sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np,json,hashlib,shutil
from pathlib import Path
cv2.setNumThreads(1);here=Path(__file__).resolve().parent;repo=next(p for p in here.parents if p.name=='croupier');src=repo/'content/staging/2026-09-09/contact-proof';combined=repo/'content/staging/2026-09-09/centre-entry-clean/combined';pace=json.load(open(here.parent/'pace/receipt.json'));track=json.load(open(src/'marker-tracking.json'));out=here/'selected85';out.mkdir(exist_ok=True);rows=[];tiles=[]
shoe=[[784,405],[850,309],[919,338],[919,391],[840,464],[784,443]]
for row in pace['frames']:
 n=row['sourceNative'];k=row['outputFrame'];f=combined/f"contact-masks/{row['packedNative']+1:04d}.png";a=cv2.imread(str(combined/f"frames/{row['packedNative']+1:04d}.png"));m=cv2.imread(str(f));r=m[:,:,2].copy();g=m[:,:,1].copy();polys=[];origin='existing prefix PNG' if n is None else 'source-bound selected extension';fixed=here/'critical-v4'/f'{n:04d}.png' if n is not None else None
 if n is not None and fixed.exists():new=cv2.imread(str(fixed));origin='frozen critical-v4';r=new[:,:,2];g=new[:,:,1]
 elif n is not None:
  domain=np.zeros_like(r);polys=[shoe]
  if n<50:polys.append([[750,416],[846,407],[855,446],[790,478],[750,453]])
  elif n>=84:polys.append([[610,522],[663,522],[667,574],[610,576]])
  else:
   # Tracking rectangle is ONLY a search window. Actual white component hull defines paper removal.
   q=np.array(track[n]['corners'])[:,:2]*[1280,720];lo=np.floor(q.min(0)-4).astype(int);hi=np.ceil(q.max(0)+4).astype(int);window=np.zeros_like(r);window[max(0,lo[1]):min(720,hi[1]),max(0,lo[0]):min(1280,hi[0])]=255
   ai=a.astype(int);white=(ai[:,:,2]>170)&(ai[:,:,1]>160)&(ai[:,:,0]>120)&(abs(ai[:,:,2]-ai[:,:,1])<30)&(window>0)
   cs,_=cv2.findContours(white.astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
   if cs:
    hull=cv2.convexHull(max(cs,key=cv2.contourArea));paper=np.zeros_like(r);cv2.drawContours(paper,[hull],-1,255,-1);domain=np.maximum(domain,cv2.dilate(paper,np.ones((5,5),np.uint8)));polys.append(hull[:,0,:].tolist())
  for q in polys:cv2.fillPoly(domain,[np.array(q,np.int32)],255)
  roi=np.zeros_like(r);roi[350:595,570:845]=255;ai=a.astype(int);warm=(ai[:,:,2]>50)&(ai[:,:,2]-ai[:,:,1]>10)&(ai[:,:,1]-ai[:,:,0]>3)&(roi>0);strong=(ai[:,:,2]>80)&(ai[:,:,2]-ai[:,:,1]>22)&(ai[:,:,1]-ai[:,:,0]>8)&(roi>0)
  masks=[]
  for w,hull in [(warm,False),(strong,True)]:
   cs,_=cv2.findContours(w.astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);p=np.zeros_like(r)
   if cs:cont=max(cs,key=cv2.contourArea);cv2.drawContours(p,[cv2.convexHull(cont)if hull else cont],-1,255,-1)
   masks.append(cv2.dilate(p,np.ones((3,3),np.uint8)))
  protect=np.minimum(*masks)
  if n>=92:protect[522:577,609:668]=0;g[522:577,609:668]=0
  r[(domain>0)&(protect==0)]=0
 new=np.dstack([np.zeros_like(r),np.minimum(g,r),r]);dest=out/f'{k:04d}.png';cv2.imwrite(str(dest),new)
 rows.append({**row,'file':dest.name,'origin':origin,'input':str(f.relative_to(repo)),'inputSHA256':hashlib.sha256(f.read_bytes()).hexdigest(),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'domains1280':polys,'RRemovedPixels':int(np.count_nonzero((m[:,:,2]>0)&(r==0))),'GoutsideR':int(np.count_nonzero(new[:,:,1]>r))})
 z=(a*(r[:,:,None]/255)+45*(1-r[:,:,None]/255)).astype(np.uint8);c=z[330:620,570:925] if n is not None else z[0:620,400:940];small=cv2.resize(c,(355,290));cv2.putText(small,f'out{k} source{n}',(4,18),0,.5,(0,255,255),1);tiles.append(small)
for start in range(0,85,15):
 ts=tiles[start:start+15]
 while len(ts)<15:ts.append(np.zeros_like(ts[0]))
 cv2.imwrite(str(out/f'whole-{start:02d}.jpg'),np.concatenate([np.concatenate(ts[i:i+5],axis=1)for i in range(0,15,5)]))
meta={'status':'selected85 RG candidate, visual review pending, not final gameplay approval','dimensions':[1280,720],'count':85,'channels':'PNG R actor G existing foreground clamped toR B0','clock':'output filename0000..0084 equals pace outputFrame. First10 samples existing prefix; following75 sourceNative exact from pace receipt.','paceReceiptSHA256':hashlib.sha256((here.parent/'pace/receipt.json').read_bytes()).hexdigest(),'sourceRGB':'unchanged; all input PNGs immutable','limitations':['1280 masks do not supply native1920 edge detail.','Frozen critical-v4 carries documented mixed paper rim and contact shadow91.','Extension uses actual white component hull inside tracking searchwindow, not tracking quadrilateral as erasure geometry.','Existing G heuristic and table lettering outside paper/shoe domains remain unapproved.'],'frames':rows};meta['manifestSHA256']=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest();(out/'receipt.json').write_text(json.dumps(meta,indent=2));print(meta['manifestSHA256'])
