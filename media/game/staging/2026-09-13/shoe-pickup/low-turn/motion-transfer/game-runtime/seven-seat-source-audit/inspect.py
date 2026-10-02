import sys;sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np,json,hashlib
from pathlib import Path
here=Path(__file__).resolve().parent;repo=next(p for p in here.parents if p.name=='croupier');sources={'legacy-left':'content/staging/2026-09-09/cac-side-delivery/left/source.mp4','legacy-right':'content/staging/2026-09-09/cac-side-delivery/right-corrected/source.mp4','old-seat2':'content/staging/2026-09-13/per-seat-video/seat-2-source.mp4'};rows=[]
for name,path in sources.items():
 p=repo/path;c=cv2.VideoCapture(str(p));count=int(c.get(7));indices=[0,20,44,56,72,count-1];tiles=[]
 for n in indices:
  c.set(1,n);ok,a=c.read();assert ok;h,w=a.shape[:2];b=cv2.resize(a[int(h*.31):int(h*.85),int(w*.10):int(w*.93)],(720,270));cv2.putText(b,f'{name} native{n}',(8,24),0,.7,(0,255,255),1);tiles.append(b)
 cv2.imwrite(str(here/f'{name}.jpg'),np.concatenate([np.concatenate(tiles[i:i+2],axis=1)for i in range(0,6,2)]));rows.append({'name':name,'path':path,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'frames':count,'fps':c.get(5),'size':[w,h],'inspected':indices})
json.dump(rows,open(here/'legacy-source-provenance.json','w'),indent=2)
