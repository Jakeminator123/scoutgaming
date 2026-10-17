"""Extract source-video facial performance, preserving original media timestamps.
This is measurement data, not lip-sync approval or a replacement audio track.
"""
import argparse,hashlib,json,math
from pathlib import Path
import cv2,mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('output',type=Path);p.add_argument('--model',default='/Users/solvifyab/.codex/tools/astrid-face/face_landmarker.task');p.add_argument('--sample-fps',type=float,default=30);p.add_argument('--fps',type=float);p.add_argument('--expected-frame-count',type=int);p.add_argument('--audio',type=Path);p.add_argument('--audio-delay-ms',type=float);p.add_argument('--line-id');p.add_argument('--text');args=p.parse_args()
if args.audio and args.audio_delay_ms is None:p.error('Indexed audio requires its explicit calibration --audio-delay-ms')
cap=cv2.VideoCapture(str(args.video));fps=args.fps or cap.get(cv2.CAP_PROP_FPS);width=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH));height=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT));frames=[];missing=[];index=0;last=-1
if not math.isfinite(fps) or fps<=0:raise ValueError('Source FPS missing; pass the indexed --fps')
options=vision.FaceLandmarkerOptions(base_options=python.BaseOptions(delegate=python.BaseOptions.Delegate.CPU,model_asset_path=args.model),running_mode=vision.RunningMode.VIDEO,num_faces=1,output_face_blendshapes=True,min_face_detection_confidence=.5,min_face_presence_confidence=.5,min_tracking_confidence=.5)
with vision.FaceLandmarker.create_from_options(options) as detector:
 while True:
  ok,frame=cap.read()
  if not ok:break
  t=index/fps;index+=1
  if int(t*args.sample_fps)==last:continue
  last=int(t*args.sample_fps)
  if max(width,height)>1280:frame=cv2.resize(frame,(round(width*1280/max(width,height)),round(height*1280/max(width,height))))
  image=mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(frame,cv2.COLOR_BGR2RGB));result=detector.detect_for_video(image,round(t*1000))
  if len(result.face_blendshapes)!=1:missing.append(round(t,6));continue
  frames.append({'time':round(t,6),'weights':{x.category_name:round(x.score,5) for x in result.face_blendshapes[0]}})
cap.release()
if args.expected_frame_count is not None and index!=args.expected_frame_count:raise ValueError(f'Decoded {index} frames, expected {args.expected_frame_count}')
if not frames:raise RuntimeError('No face detected; no performance file written')
status='measured-not-visually-approved' if len(missing)/(len(frames)+len(missing))<.05 else 'incomplete-detection'
def web_url(path):
 try:return path.resolve().relative_to(Path(__file__).resolve().parents[2]/'web/public').as_posix()
 except ValueError:return None
sourceHash=hashlib.sha256(args.video.read_bytes()).hexdigest()
output={'schemaVersion':1,'source':str(args.video),'sha256':sourceHash,'fps':fps,'duration':index/fps,'sourceFrameCount':index,'sampleFps':args.sample_fps,'frames':frames,'missingTimes':missing,'status':status,
 'binding':{'kind':'indexed-audio' if args.audio else 'embedded-video','lineId':args.line_id,'videoUrl':web_url(args.video),'audioUrl':web_url(args.audio or args.video),'audioSha256':hashlib.sha256(args.audio.read_bytes()).hexdigest() if args.audio else sourceHash,'audioDelayMs':args.audio_delay_ms or 0,'text':args.text}}
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(output,separators=(',',':')))
print(json.dumps({k:output[k] for k in ['duration','sourceFrameCount','status']}), 'samples',len(frames),'missing',len(missing))
