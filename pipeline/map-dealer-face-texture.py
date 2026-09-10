"""Find full-face UV correspondence to the generated neutral-light identity reference."""
from pathlib import Path
import json,mediapipe as mp,numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from scipy.spatial import Delaunay
root=Path(__file__).resolve().parents[1];out=root/'content/staging/2026-09-10/astrid-head-v2';points=[]
options=vision.FaceLandmarkerOptions(base_options=python.BaseOptions(delegate=python.BaseOptions.Delegate.CPU,model_asset_path='/Users/solvifyab/.codex/tools/astrid-face/face_landmarker.task'),num_faces=1,min_face_detection_confidence=.4,min_face_presence_confidence=.4)
with vision.FaceLandmarker.create_from_options(options) as detector:
 for f in [out/'fitted-front.png',out/'astrid-neutral-reference.png']:
  im=mp.Image.create_from_file(str(f));r=detector.detect(im)
  if len(r.face_landmarks)!=1:raise ValueError('Face not detected: '+str(f))
  points.append(np.array([[p.x*im.width,p.y*im.height] for p in r.face_landmarks[0]][:468]))
a,b=points;a*=2
# Anchors beyond the facial landmark hull cover scalp and neck; reference pixels are inspected locally.
anchors=np.array([[450,55],[270,100],[630,100],[230,235],[670,235],[275,770],[625,770],[250,900],[650,900]],float)
scale=(b[152,1]-b[10,1])/(a[152,1]-a[10,1]);target=(anchors-a[10])*scale+b[10]
# Scalp crown is above the eyebrow-to-chin similarity region.
target[0]=[1024,65];target[1]=[730,100];target[2]=[1330,100]
a=np.concatenate((a,anchors));b=np.concatenate((b,target));tri=Delaunay(a)
(out/'texture-fit.json').write_text(json.dumps({'source':a.tolist(),'target':b.tolist(),'triangles':tri.simplices.tolist(),'transforms':tri.transform.tolist(),'size':[2048,2048],'status':'full-face UV correspondence, not final likeness approval'}));print('Mapped',len(a),'anchors')
