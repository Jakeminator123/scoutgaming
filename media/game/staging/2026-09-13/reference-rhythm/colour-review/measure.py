"""Diagnostic only: compare cheek regions relative to detected face bounds.
No public media, manifest, calibration or baseline is changed.
"""
from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parent
def sample(path,face):
    a=np.array(Image.open(path).convert('RGB'));h,w=a.shape[:2]
    x,y,bw,bh=face['bounds'];patches=[];boxes=[]
    for cx in [.24,.76]:
        xx=int((x+bw*cx)*w);yy=int((y+bh*.58)*h)
        rx=max(2,round(bw*w*.045));ry=max(2,round(bh*h*.055))
        boxes.append([xx-rx,yy-ry,xx+rx,yy+ry])
        patches.append(a[yy-ry:yy+ry,xx-rx:xx+rx].reshape(-1,3))
    return np.median(np.concatenate(patches),axis=0),boxes
idleface=json.loads((root/'idle-face.json').read_text())[0]
idle,boxes=sample(root/'frames/idle.png',idleface)
frames=[]
for f in json.loads((root/'source-faces.json').read_text()):
    n=int(Path(f['file']).stem)-1
    if n>=48:continue
    value,rois=sample(root.parent/'integration/frames'/f['file'],f)
    frames.append({'frame':n,'medianRGB':value.tolist(),'ROIs':rois,'faceConfidence':f['confidence']})
groups=[]
for action,start,stop in [('right',3,22),('centre',21,35),('left',34,48)]:
    a=np.array([f['medianRGB'] for f in frames if start<=f['frame']<stop])
    median=np.median(a,axis=0)
    groups.append({'action':action,'sourceRange':[start,stop],'medianRGB':median.tolist(),'minRGB':a.min(axis=0).tolist(),'maxRGB':a.max(axis=0).tolist(),'diagnosticGain':(idle/median).round(4).tolist()})
report={'status':'diagnostic-not-gameplay-approval','reference':{'medianRGB':idle.tolist(),'ROIs':boxes},'sourceSha256':hashlib.sha256((root.parent/'source.mp4').read_bytes()).hexdigest(),'groups':groups,'frames':frames,'limitations':['Face bounds are not anatomical landmark tracking.','Downward head pose and changed lighting affect corresponding cheek patches.','These ratios must not be installed without camera-matched gameplay comparison.']}
(root/'measurements.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'reference':report['reference'],'groups':groups},indent=2))
