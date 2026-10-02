import sys,pathlib,json,hashlib,shutil,copy
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2,numpy as np
cv2.setNumThreads(1)
p=pathlib.Path('/Users/solvifyab/Desktop/croupier/content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/game-runtime/dealer-up');src=p/'selected85-rg';out=p/'selected85-clean-rg';out.mkdir(exist_ok=True);proof=p/'head-clean-review';rec=json.load(open(src/'receipt.json'));cap=cv2.VideoCapture('/Users/solvifyab/Desktop/croupier/web/public/dealers/astrid/performance/centre-native-review.mp4');tiles=[];ann=[]
sha=lambda f:hashlib.sha256(pathlib.Path(f).read_bytes()).hexdigest()
for row in rec['frames']:
 n=row['outputFrame'];f=src/row['file'];a=cv2.imread(str(f));b=a.copy();polys=[]
 if n<40:
  # Reviewed lamp band outside left hair. Boundary stays four source pixels outside visible hair/ear.
  edge=float(np.interp(n,[0,10,18,24,39],[892,899,927,934,937]))-4
  polys.append([[835,148],[edge,148],[edge,179],[835,179]])
  # Confirmed room lamp/table light left of neck and above left shoulder.
  dx=float(np.interp(n,[0,10,18,24,39],[0,2,20,24,25]))
  base=np.array([[825,214],[901,214],[912,232],[918,246],[909,257],[892,263],[871,273],[846,276],[825,277]],float);base[:,0]+=dx;polys.append(base.tolist())
  if n<=10:polys.append([[1032,148],[1090,148],[1090,172],[1032,172]])
  # Far outer right lamp lobe only. Inner suit-edge glow deliberately retained.
  polys.append([[1042,250],[1110,250],[1110,274],[1074,270],[1056,267],[1042,261]])
  erase=np.zeros(a.shape[:2],np.uint8)
  for poly in polys:cv2.fillPoly(erase,[np.rint(poly).astype(np.int32)],255)
  # Exactly source-defined domains: no colour classifier and no dilation into anatomy.
  b[erase>0]=0
  cv2.imwrite(str(out/row['file']),b)
  cap.set(cv2.CAP_PROP_POS_FRAMES,row['combinedNative']);ok,rgb=cap.read();assert ok;rgb=rgb[:1080]
  def comp(m):return (rgb*(m[:,:,2:3]/255)+30*(1-m[:,:,2:3]/255)).astype('uint8')[50:450,800:1140]
  tile=np.concatenate([comp(a),comp(b)],axis=1);cv2.putText(tile,f'out {n}: before | after',(5,18),0,.5,(0,255,255),1);tiles.append(tile)
  if n in [0,10,18,30,39]:cv2.imwrite(str(proof/f'clean-critical-{n:02}.jpg'),tile)
 else:shutil.copyfile(f,out/row['file'])
 change=np.any(a!=b,axis=2);ys,xs=np.where(change)
 row['originalMaskSHA256']=sha(f);row['sha256']=sha(out/row['file']);row['cleanupChangedPixels']=int(change.sum());row['cleanupBounds']=None if not len(xs) else [int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
 assert np.all(b<=a);assert np.all(b[:,:,1]<=b[:,:,2]);assert not n>=40 or row['sha256']==row['originalMaskSHA256']
 ann.append({'outputFrame':n,'namespace':row['namespace'],'sourceNative':row['sourceNative'],'polygons':polys,'changedPixels':int(change.sum())})
for i in range(0,40,5):cv2.imwrite(str(proof/f'clean-all-{i:02}.jpg'),np.concatenate(tiles[i:i+5]))
rec['originalReceiptSHA256']=sha(src/'receipt.json');rec['cleanupPolicy']='Source-observed background lamp domains only; explicit per-frame polygons. R and G reduced together, no RGB edit, no alpha increase. Mixed hair/suit edge retained. Right output40..84 byte-identical.';rec['cleanupChangedPixels']=sum(x['changedPixels'] for x in ann);rec['manifestSHA256']=hashlib.sha256(''.join(r['sha256'] for r in rec['frames']).encode()).hexdigest();(out/'receipt.json').write_text(json.dumps(rec,indent=2));(out/'polygons.json').write_text(json.dumps(ann,indent=2));# Reproducer resides here; no source RGB or frozen masks are modified.
print(rec['cleanupChangedPixels'],rec['manifestSHA256'])
