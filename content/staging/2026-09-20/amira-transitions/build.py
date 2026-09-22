"""Fit silent whole-actor joins; never change speech, audio, matte or placement."""
from pathlib import Path
import cv2, numpy as np, json, hashlib, copy
from PIL import Image, ImageDraw
cv2.setNumThreads(1)
ROOT=Path(__file__).resolve().parents[4];PUB=ROOT/'web/public';HERE=Path(__file__).parent
OUT=PUB/'review/amira-transitions';OUT.mkdir(exist_ok=True)
idle=json.loads((PUB/'review/amira-green-waiting/idle.json').read_text())
speak=json.loads((PUB/'review/amira-green-speak/speak.json').read_text())
profile=json.loads((PUB/'review/amira-composite/profile.json').read_text())
W,H=480,466
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
sp=next(iter(speak['lines'].values()))['camera']['placement'];ip=idle['camera']['placement']
reg={'scale':ip['scale']/sp['scale'],'x':(ip['x']-sp['x'])/sp['scale'],'y':(ip['y']-sp['y'])/sp['scale']}
def read(media,frame,kind,r):
 p=PUB/media['src'];assert sha(p)==media['sha256']
 cap=cv2.VideoCapture(str(p));cap.set(cv2.CAP_PROP_POS_FRAMES,frame);ok,b=cap.read();cap.release();assert ok
 h=media['height'];a=np.dstack([cv2.cvtColor(b[:h],cv2.COLOR_BGR2RGB),b[h:,:,0]])
 rgb=a[:,:,:3].astype(np.float32)/255;g=profile[kind];lum=rgb@np.array([.2126,.7152,.0722])
 target=np.interp(lum,[0,.25,.5,.75,1],g['curve']);rgb*=target[:,:,None]/np.maximum(lum[:,:,None],1e-5)
 l=(rgb.max(2)+rgb.min(2))[:,:,None]/2;rgb=(l+(rgb-l)*g['saturation'])*g['temperatureRGB']
 a[:,:,:3]=np.uint8(np.clip(rgb*255,0,255))
 return cv2.warpAffine(a,np.float32([[r['scale'],0,r['x']],[0,r['scale'],r['y']]]),(W,H))
def grey(a):return cv2.cvtColor(np.uint8(a[:,:,:3]*(a[:,:,3:4]/255)+48*(1-a[:,:,3:4]/255)),cv2.COLOR_RGB2GRAY)
def flow(a,b):
 dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM);dis.setUseSpatialPropagation(True)
 return np.clip(cv2.GaussianBlur(dis.calc(grey(a),grey(b),None),(5,5),1),-60,60)
def preview(a):return np.uint8(a[:,:,:3]*(a[:,:,3:4]/255)+35*(1-a[:,:,3:4]/255))
def blend(a,b,t,ab,ba):
 yy,xx=np.indices((H,W),dtype=np.float32)
 def warp(im,f,amount):
  mx,my=xx-amount*f[:,:,0],yy-amount*f[:,:,1]
  for _ in range(2):
   ff=cv2.remap(f,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE);mx,my=xx-amount*ff[:,:,0],yy-amount*ff[:,:,1]
  rgba=im.astype(np.float32)/255;rgba[:,:,:3]*=rgba[:,:,3:4]
  return cv2.remap(rgba,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
 out=(1-t)*warp(a,ab,t)+t*warp(b,ba,1-t);out[:,:,:3]/=np.maximum(out[:,:,3:4],1e-5)
 return np.uint8(np.clip(out*255,0,255))
rest=read(idle['base'],0,'waiting',reg);metrics={};sheet=Image.new('RGB',(5*240,6*250),'#232323');draw=ImageDraw.Draw(sheet)
for id,line in speak['lines'].items():
 m=line['media'];first=read(m,line['cutIn'],'speech',{'scale':1,'x':0,'y':0});last=read(m,line['cutOut'],'speech',{'scale':1,'x':0,'y':0})
 j={'width':W,'height':H,'durationMs':320,'flowRange':64,'actorOffset':speak['actorOffset'],'idleSha256':idle['base']['sha256'],'mediaSha256':m['sha256'],'composited':True,'idleRegistration':reg,'method':'Bidirectional whole-actor DIS flow over fixed existing registration. Runtime snapshots retain identical grading, matte and edge finish at both endpoints. Silent join only; untouched native speech and exact MP3.'}
 for edge,a,b in [('enter',rest,first),('exit',last,rest)]:
  ab,ba=flow(a,b),flow(b,a);encoded=[]
  for f in [ab,ba]:
   small=cv2.resize(f,(W//2,H//2),interpolation=cv2.INTER_AREA);e=np.full((H//2,W//2,3),255,np.uint8);e[:,:,:2]=np.clip(np.round(small*2+128),0,255).astype(np.uint8);encoded.append(e)
  tmp=OUT/f'{id}-{edge}.png';Image.fromarray(np.vstack(encoded)).save(tmp);digest=sha(tmp);target=OUT/f'{id}-{edge}-{digest[:12]}.png';tmp.rename(target)
  j[edge]={'src':f'review/amira-transitions/{target.name}','sha256':digest}
  mask=a[:,:,3]>.5*255;v=np.linalg.norm(ab,axis=2)[mask]
  metrics[f'{id}-{edge}']={'flowPixelsP50P95Max':np.percentile(v,[50,95,100]).tolist(),'sourceToTargetMeanRGBError':float(np.abs(preview(a).astype(float)-preview(b)).mean())}
  if id in ['greeting','goodluck','dealerblackjack']:
   row=['greeting','goodluck','dealerblackjack'].index(id)*2+(edge=='exit')
   for k,t in enumerate([0,.25,.5,.75,1]):sheet.paste(Image.fromarray(preview(blend(a,b,t,ab,ba))).resize((240,233)),(k*240,row*250+17))
   draw.text((3,row*250+2),f'{id} {edge}: idle / speech endpoints unchanged',fill='white')
 line['transition']=j
speak['transitionRevision']='amira-existing-source-joins-v1'
(HERE/'candidate-speak.json').write_text(json.dumps(speak,indent=2)+'\n')
(HERE/'measurements.json').write_text(json.dumps(metrics,indent=2)+'\n');sheet.save(HERE/'join-review.jpg',quality=95)
print(json.dumps({'joins':len(metrics),'registration':reg,'sourceFilesModified':False}))
