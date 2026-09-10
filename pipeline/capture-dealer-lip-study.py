"""Derive an isolated rig-calibration study from source lip landmarks.

Raw measured blendshapes remain untouched in the shipping capture. This study
uses a measured local jaw response and must be checked on held-out phonemes.
"""
import argparse,copy,hashlib,json
from pathlib import Path
import cv2,mediapipe as mp,numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
p=argparse.ArgumentParser();p.add_argument('capture',type=Path);p.add_argument('video',type=Path);p.add_argument('output',type=Path);args=p.parse_args()
source=json.loads(args.capture.read_text())
if hashlib.sha256(args.video.read_bytes()).hexdigest()!=source['sha256']:raise ValueError('Wrong source video')
data=copy.deepcopy(source);data['status']='derived-jaw-calibration-study-not-approved';data['calibration']={'method':'image-space inner lip aperture / outer eye distance','modelResponseSlope':(.1010013921765703-.002429862497902294)/(.28-.02778),'modelResponseIntercept':None,'fitSourceTime':2.0,'heldOutReview':'pending'}
cal=data['calibration'];cal['modelResponseIntercept']=.002429862497902294-cal['modelResponseSlope']*.02778
options=vision.FaceLandmarkerOptions(base_options=python.BaseOptions(model_asset_path='/Users/solvifyab/.codex/tools/astrid-face/face_landmarker.task'),running_mode=vision.RunningMode.IMAGE,num_faces=1,min_face_detection_confidence=.5,min_face_presence_confidence=.5)
cap=cv2.VideoCapture(str(args.video));index=0;measured={}
with vision.FaceLandmarker.create_from_options(options) as detector:
 while True:
  ok,frame=cap.read()
  if not ok:break
  time=index/source['fps'];index+=1;h,w=frame.shape[:2];image=mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(frame,cv2.COLOR_BGR2RGB));r=detector.detect(image)
  if len(r.face_landmarks)!=1:continue
  xy=np.array([[v.x*w,v.y*h] for v in r.face_landmarks[0]]);axis=xy[263]-xy[33];scale=np.linalg.norm(axis);axis/=scale;vertical=np.array([-axis[1],axis[0]]);aperture=max(0,float((xy[14]-xy[13])@vertical/scale))
  measured[round(time,6)]={'innerLipOpening':aperture,'mouthWidth':float(np.linalg.norm(xy[291]-xy[61])/scale)}
cap.release()
for f in data['frames']:
 metric=measured.get(round(f['time'],6))
 if metric is None:raise ValueError(f'Missing lip observation at {f["time"]}')
 f['sourceJawOpen']=f['weights']['jawOpen'];f['lipLandmarks']=metric
 aperture=metric['innerLipOpening'];f['weights']['jawOpen']=0 if aperture<.004 else min(.75,max(0,(aperture-cal['modelResponseIntercept'])/cal['modelResponseSlope']))
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(data,separators=(',',':')))
ordered=sorted(data['frames'],key=lambda f:f['lipLandmarks']['innerLipOpening']);samples=[ordered[round((len(ordered)-1)*q)] for q in [0,.25,.5,.75,1]]
print(json.dumps({'frames':len(data['frames']),'calibration':cal,'reviewFrames':[{k:v for k,v in f.items() if k!='weights'}|{'jawOpen':f['weights']['jawOpen']} for f in samples]},indent=2))
