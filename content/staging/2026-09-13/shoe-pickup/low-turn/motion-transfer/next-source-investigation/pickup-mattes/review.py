import sys;sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np,json,hashlib
from pathlib import Path
cv2.setNumThreads(1)
here=Path(__file__).resolve().parent;source=here.parent/'kling-primitive.mp4';ledger=json.loads((here/'person/timestamps.json').read_text())['frames'];assert len(ledger)==73;cap=cv2.VideoCapture(str(source));rows=[];sheets=[]
for n,row in enumerate(ledger):
 ok,rgb=cap.read();assert ok;maskFile=here/'person'/row['file'];m=cv2.imread(str(maskFile),0);assert m.shape==(1080,1920);assert abs(row['pts']-n/24)<1e-6;record={**row,'sha256':hashlib.sha256(maskFile.read_bytes()).hexdigest(),'nonzeroAlphaPixels':int(np.count_nonzero(m))}
 if n in [0,30,48,60,72]:
  x,y,w,h=1080,540,260,160;box=(slice(y,y+h),slice(x,x+w));alpha=m[:,:,None]/255;composite=(rgb*alpha+np.array([45,50,45])*(1-alpha)).astype('uint8');sheet=np.concatenate([rgb[box],cv2.cvtColor(m[box],cv2.COLOR_GRAY2BGR),composite[box]],axis=1);cv2.putText(sheet,f'native{n} crop{x},{y}',(4,16),cv2.FONT_HERSHEY_SIMPLEX,.45,(0,255,255),1);sheets.append(cv2.resize(sheet,None,fx=1.5,fy=1.5));record['reviewContactCrop']=[x,y,w,h]
 rows.append(record)
assert not cap.read()[0];cv2.imwrite(str(here/'contact-keyframes.jpg'),np.concatenate(sheets));manifest=json.dumps(rows,separators=(',',':'));receipt={'schema':'astrid-native-person-mask-v1','status':'raw Vision masks, source contact review pending','source':str(source.resolve()),'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'frameCount':73,'fps':24,'dimensions':[1920,1080],'method':'VNGeneratePersonSegmentationRequest accurate OneComponent8; source AVAssetReader PTS; uniformly resized to source dimensions','manifestSHA256':hashlib.sha256(manifest.encode()).hexdigest(),'maskMeaning':'grayscaleR actor coverage, NOT foreground hand G; sourcepaper/edge residues may remain','scope':'low partial pickup only; no turnover or delivery; no RGB edits/runtime changes','frames':rows};(here/'receipt.json').write_text(json.dumps(receipt,indent=2));print(receipt['manifestSHA256'])
