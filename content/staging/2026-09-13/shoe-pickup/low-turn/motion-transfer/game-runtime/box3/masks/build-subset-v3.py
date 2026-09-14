import sys;sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np,json,hashlib
from pathlib import Path
cv2.setNumThreads(1);here=Path(__file__).resolve().parent;repo=next(p for p in here.parents if p.name=='croupier');src=repo/'content/staging/2026-09-09/contact-proof';out=here/'critical-v3';out.mkdir(exist_ok=True);rows=[];tiles=[]
# Native1280x720 source-confirmed shoe and paper domain. This is not a card pose.
shoe=[[784,405],[850,309],[919,338],[919,391],[840,464],[784,443]]
for n in list(range(38,50))+list(range(84,97)):
 name=f'{n+1:04d}.png';a=cv2.imread(str(src/'frames'/name));m=cv2.imread(str(src/'contact-masks'/name));raw=cv2.imread(str(src/'person'/name));r=m[:,:,2].copy();g=m[:,:,1].copy();domain=np.zeros_like(r);polys=[]
 if n<50:
  polys.append(shoe)
  # Broad local paper domain follows observed source footprint; hand explicitly protected.
  polys.append([[750,416],[846,407],[855,446],[790,478],[750,453]])
 else:polys.append([[610,522],[663,522],[667,574],[610,576]])
 for q in polys:cv2.fillPoly(domain,[np.array(q,np.int32)],255)
 # Keep existing foreground plus a one1280px mixed-contact margin. No source RGB edits.
 # Existing G has a hard y406 ROI edge: it cannot protect the upper hand.
 warm=(a[:,:,2].astype(int)>50)&(a[:,:,2].astype(int)-a[:,:,1].astype(int)>10)&(a[:,:,1].astype(int)-a[:,:,0].astype(int)>3)
 roi=np.zeros_like(r);roi[360:478,700:845]=255 if n<50 else 0
 if n>=50:roi[465:550,590:668]=255
 seed=(warm&(roi>0)).astype(np.uint8)*255
 cs,_=cv2.findContours(seed,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);skin=np.zeros_like(r)
 if cs:cv2.drawContours(skin,[max(cs,key=cv2.contourArea)],-1,255,-1)
 protect=cv2.dilate(skin,np.ones((3,3),np.uint8))
 if n>=92:protect[522:577,609:668]=0;g[522:577,609:668]=0
 if n==91:protect[532:577,609:668]=0;g[532:577,609:668]=0
 remove=(domain>0)&(protect==0);r[remove]=0
 # Current G is not promoted to observed perfect fingers; preserve its bytes exactly.
 new=np.dstack([np.zeros_like(r),np.minimum(g,r),r]);cv2.imwrite(str(out/f'{n:04d}.png'),new)
 crop=(700,360,910,490)if n<50 else(590,470,690,590);x,y,x1,y1=crop;panels=[]
 for alpha in [None,m[:,:,2],r]:
  z=a if alpha is None else(a*(alpha[:,:,None]/255)+45*(1-alpha[:,:,None]/255)).astype(np.uint8)
  panels.append(cv2.resize(z[y:y1,x:x1],(420,260)))
 tile=np.concatenate(panels,axis=1);cv2.putText(tile,f'n{n}: source | existing | confirmed BG removal',(5,20),0,.55,(0,255,255),1);tiles.append(tile)
 rows.append({'sourceNative':n,'sourceFile':name,'output':f'critical-v3/{n:04d}.png','sha256':hashlib.sha256((out/f'{n:04d}.png').read_bytes()).hexdigest(),'inputSHA256':hashlib.sha256((src/'contact-masks'/name).read_bytes()).hexdigest(),'domains1280':polys,'removedNonzeroR':int(np.count_nonzero((m[:,:,2]>0)&(r==0))),'GChanged':int(np.count_nonzero(m[:,:,1]!=new[:,:,1]))})
for k in range(0,len(tiles),5):cv2.imwrite(str(here/f'critical-v3-proof-{k//5}.jpg'),np.concatenate(tiles[k:k+5]))
json.dump({'status':'Critical subset only; source visual review pending','dimensions':[1280,720],'fileClock':'output filename is zero-based SOURCE native; input filename is native+1; packed frame is native+24','method':'Source-confirmed shoe/paper domains minus existing G dilated1px. Source source weak-warm connected external hand protection contour protects upper palm beyond old G ROI; release92+ confirmed separated paper removed from G too; RGB untouched. No paper silhouette inferred as card geometry.','limits':['Does not fix preexisting G skin omissions or G contamination.','One1280px mixed boundary retained to avoid eroding fingers.','Not all145 frames. Must review temporal boundaries before packing.'],'frames':rows},open(here/'critical-v3-receipt.json','w'),indent=2)
