"""Measure the canonical identity proportions for the anatomical face candidate."""
from pathlib import Path
import json,mediapipe as mp,numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from scipy.spatial import Delaunay
root=Path(__file__).resolve().parents[1];out=root/'media/dealers/astrid/staging/2026-09-10/astrid-head-v2'
options=vision.FaceLandmarkerOptions(base_options=python.BaseOptions(delegate=python.BaseOptions.Delegate.CPU,model_asset_path='/Users/solvifyab/.codex/tools/astrid-face/face_landmarker.task'),num_faces=1,min_face_detection_confidence=.4,min_face_presence_confidence=.4)
points=[]
with vision.FaceLandmarker.create_from_options(options) as detector:
 for f in [out/'base-front.png',root/'media/dealers/astrid/source/generation/canonical-frame0.png']:
  im=mp.Image.create_from_file(str(f));r=detector.detect(im)
  if len(r.face_landmarks)!=1:raise ValueError('Face not detected: '+str(f))
  points.append(np.array([[p.x*im.width,p.y*im.height] for p in r.face_landmarks[0]][:468]))
a,ref=points;scale=(a[152,1]-a[10,1])/(ref[152,1]-ref[10,1]);b=(ref-ref[10])*scale+a[10]
# Deform the anatomical face; the original UV skin texture remains untouched here.
anchors=np.array([[0,0],[450,0],[900,0],[0,550],[900,550],[0,1100],[450,1100],[900,1100]],float)
a=np.concatenate((a,anchors));b=np.concatenate((b,anchors));tri=Delaunay(a)
(out/'identity-fit.json').write_text(json.dumps({'source':a.tolist(),'target':b.tolist(),'reference':ref.tolist(),'triangles':tri.simplices.tolist(),'transforms':tri.transform.tolist(),'status':'geometric fit; visual identity approval pending'}))
print('Measured468 landmarks, scale',scale,'triangles',len(tri.simplices))
