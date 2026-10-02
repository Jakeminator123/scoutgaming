import cv2,json,hashlib,numpy as np
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4];PUB=ROOT/'web/public';BASE=HERE.parent
cv2.setNumThreads(1)
old=json.loads((BASE/'inputs.json').read_text());idle=json.loads((BASE/'runtime/idle.json').read_text());speak=json.loads((BASE/'runtime/speak.json').read_text())
raw=ROOT/'content/staging/2026-09-19/astrid-green-speak-elevenlabs'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def load_frames(path):
 v=cv2.VideoCapture(str(path));fps=v.get(cv2.CAP_PROP_FPS);n=0
 while True:
  ok,b=v.read()
  if not ok:break
  h=b.shape[0]//2;n+=1
  yield cv2.cvtColor(b[:h],cv2.COLOR_BGR2RGB),b[h:,:,0],fps
 v.release()
def head_interior(a):
 roi=a[40:255,280:530];mask=np.uint8(roi>128)*255
 contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
 filled=np.zeros_like(mask)
 if contours:cv2.drawContours(filled,[max(contours,key=cv2.contourArea)],-1,255,-1)
 filled=cv2.erode(filled,np.ones((19,19),np.uint8),borderType=cv2.BORDER_CONSTANT,borderValue=0)>0
 full=np.zeros_like(a,dtype=bool);full[40:255,280:530]=filled
 return full
def stats(path,cal=None):
 out={'decodedFrames':0,'headInteriorAlphaMin':255,'eyeBandAlphaMin':255,'headPixelsBelow250':0,'eyePixelsBelow250':0,'maxOpaquePixelsOnBorder':0,'maxOpaqueSourcePixelsOutsideOutputAfterTransform':0}
 for rgb,a,fps in load_frames(path):
  out['decodedFrames']+=1;out['fps']=fps;out['packedDimensions']=[a.shape[1],a.shape[0]*2]
  m=head_interior(a);eye=m.copy();eye[:120]=False;eye[190:]=False;eye[:,:325]=False;eye[:,490:]=False
  if np.any(m):out['headInteriorAlphaMin']=min(out['headInteriorAlphaMin'],int(a[m].min()));out['headPixelsBelow250']+=int((a[m]<250).sum())
  if np.any(eye):out['eyeBandAlphaMin']=min(out['eyeBandAlphaMin'],int(a[eye].min()));out['eyePixelsBelow250']+=int((a[eye]<250).sum())
  edge=np.concatenate((a[0],a[-1],a[:,0],a[:,-1]));out['maxOpaquePixelsOnBorder']=max(out['maxOpaquePixelsOnBorder'],int((edge>240).sum()))
  if cal:
   ys,xs=np.nonzero(a>240);scale=cal['scale'];dx,dy=cal['offset'];tx=xs*scale+dx;ty=(ys+20)*scale+dy-20
   outside=(tx<0)|(tx>=a.shape[1])|(ty<0)|(ty>=a.shape[0])
   out['maxOpaqueSourcePixelsOutsideOutputAfterTransform']=max(out['maxOpaqueSourcePixelsOutsideOutputAfterTransform'],int(outside.sum()))
 return out
lines={};failures=[]
for name,new in speak['lines'].items():
 prior=old['speak']['lines'][name];m=new['media'];om=prior['media'];checks={}
 for key in ['audio','audioSha256','text','cutIn','cutOut','audioOffsetSeconds','camera']:
  checks[key+'Unchanged']=new.get(key)==prior.get(key)
 for key in ['sourceSha256','nativeTakeSha256','fps','frames','width','height','crop']:
  checks['media.'+key+'Unchanged']=m.get(key)==om.get(key)
 checks['originalPackedHash']=sha(PUB/om['src'])==om['sha256']
 checks['audioFileHash']=sha(PUB/new['audio'])==prior['audioSha256']
 checks['nativeSourceHash']=sha(raw/f'take-{name}-creatify-aurora.mp4')==om['nativeTakeSha256']
 source=raw/'source.mp4' if name=='greeting' else raw/'lines'/name/'source.mp4'
 checks['registeredSourceHash']=sha(source)==om['sourceSha256']
 checks['displayHash']=sha(PUB/m['src'])==m['sha256'];checks['parentBinding']=m['parentPackedSha256']==om['sha256']
 checks['installedManifest']=new==json.loads((PUB/'review/astrid-green-speak/speak.json').read_text())['lines'][name]
 for edge in ['enter','exit']:
  t=new['transition'][edge];checks[edge+'FlowHash']=sha(PUB/t['src'])==t['sha256']
 st=stats(PUB/m['src']);st['originalGeometry']=stats(PUB/om['src'],m['displayCalibration'])
 checks['decodedDimensions']=st['packedDimensions']==[m['width'],m['height']*2]
 checks['decodedFrameCount']=st['decodedFrames']==m['frames'];checks['decodedFps']=abs(st['fps']-m['fps'])<1e-8
 if not all(checks.values()):failures.append({'line':name,'checks':[k for k,v in checks.items() if not v]})
 lines[name]={'checks':checks,'display':st,'calibration':m['displayCalibration']}
 print(name,st['decodedFrames'],'headAlpha',st['headInteriorAlphaMin'],'eyes',st['eyeBandAlphaMin'],flush=True)
def seam(path):
 frames=list(load_frames(path));changes=[]
 for (rgb,a,_),(nxt,b,__) in zip(frames,frames[1:]+frames[:1]):
  m=head_interior(a)&head_interior(b)&(a>250)&(b>250)
  d=np.abs(rgb.astype(np.float32)-nxt.astype(np.float32)).mean(2)
  changes.append(float(d[m].mean()))
 adjacent=np.array(changes[:-1]);return {'frames':len(frames),'headInteriorRgbMeanAbsDifference':{'wrap':changes[-1],'adjacentMedian':float(np.median(adjacent)),'adjacentP95':float(np.percentile(adjacent,95)),'adjacentMax':float(adjacent.max()),'wrapOverMedian':changes[-1]/float(np.median(adjacent))},'largestInteriorChanges':[{'frame':int(i),'nextFrame':int(i+1),'rgbMeanAbsDifference':float(changes[i])} for i in np.argsort(adjacent)[-3:][::-1]]}
rest={}
for k in ['loop','out','back']:
 m=idle['rest'][k];rest[k]={'stats':stats(PUB/m['src']),'hashValid':sha(PUB/m['src'])==m['sha256'],'sourceHashPreserved':m['sourceSha256']==old['idle']['rest'][k]['sourceSha256']}
report={'scope':'Independent file/hash/timing/encoded-alpha/crop/loop measurements only; not visual or phoneme acceptance.','method':{'head':'x280:530 y40:255; external alpha silhouette filled then eroded 9 px with zero ROI border (excludes clipped ROI edges); eye band restricted to x325:490 y120:190; counts inspect every encoded frame','loop':'RGB mean absolute pixel difference in intersection of both opaque eroded head interiors; wrap compared with all native/output adjacent frame pairs','crop':'original opaque source coordinates transformed with fixed uniform display calibration into the unchanged packed crop; actorOffset +20/-20 accounted for'},'failures':failures,'all17Present':set(speak['lines'])==set(old['speak']['lines']) and len(lines)==17,'actorOffsetUnchanged':speak['actorOffset']==old['speak']['actorOffset'],'cameraPlacementUnchanged':idle['camera']==old['idle']['camera'] and idle['rest']['camera']==old['idle']['rest']['camera'],'installedIdleMatches':idle==json.loads((PUB/'review/astrid-green-waiting/idle.json').read_text()),'lines':lines,'rest':rest,'loopBefore':seam(PUB/old['idle']['rest']['loop']['src']),'loopAfter':seam(PUB/idle['rest']['loop']['src'])}
(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
summary={'failures':failures,'all17Present':report['all17Present'],'speechFrames':sum(v['display']['decodedFrames'] for v in lines.values()),'minimumHeadAlpha':min(v['display']['headInteriorAlphaMin'] for v in lines.values()),'minimumEyeAlpha':min(v['display']['eyeBandAlphaMin'] for v in lines.values()),'maxNewCropLoss':max(v['display']['originalGeometry']['maxOpaqueSourcePixelsOutsideOutputAfterTransform'] for v in lines.values()),'loopBefore':report['loopBefore'],'loopAfter':report['loopAfter'],'restAlpha':{k:v['stats']['headInteriorAlphaMin'] for k,v in rest.items()}}
(HERE/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
