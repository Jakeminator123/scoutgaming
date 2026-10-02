#!/usr/bin/env python3
"""Non-destructive display calibration and motion-matched silent loop seams.
Source speech/audio/frame timings are preserved; calibrated copies and flow maps
are hash-bound as a new review revision, never as previously accepted footage.
"""
import cv2,hashlib,json,subprocess,sys,copy
import numpy as np
from pathlib import Path
from PIL import Image,ImageDraw
from calibrate import HERE,REPO,PUB,W,H,read,transform,ref,fit,grade
cv2.setNumThreads(1);OUT=HERE/'runtime';OUT.mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
snapshot=HERE/'inputs.json'
if not snapshot.exists():snapshot.write_text(json.dumps({'idle':json.loads((PUB/'review/astrid-green-waiting/idle.json').read_text()),'speak':json.loads((PUB/'review/astrid-green-speak/speak.json').read_text())},indent=2)+'\n')
inputs=json.loads(snapshot.read_text());idle=copy.deepcopy(inputs['idle']);speak=copy.deepcopy(inputs['speak']);cal=json.loads((HERE/'calibration.json').read_text())
def packed_frames(src,dy=0):
 v=cv2.VideoCapture(str(PUB/src))
 while True:
  ok,b=v.read()
  if not ok:break
  h=b.shape[0]//2;w=b.shape[1];a=np.zeros((H,W,4),np.uint8);a[:h,:w,:3]=cv2.cvtColor(b[:h],cv2.COLOR_BGR2RGB);a[:h,:w,3]=b[h:,:,0]
  yield cv2.warpAffine(a,np.float32([[1,0,0],[0,1,dy]]),(W,H)) if dy else a
 v.release()
def grey(a):return cv2.cvtColor(np.uint8(a[...,:3]*(a[...,3:4]/255)+48*(1-a[...,3:4]/255)),cv2.COLOR_RGB2GRAY)
def flow(a,b):
 dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM);dis.setUseSpatialPropagation(True)
 return np.clip(cv2.GaussianBlur(dis.calc(grey(a),grey(b),None),(5,5),1),-60,60)
def blend(a,b,t,ab=None,ba=None):
 ab=flow(a,b) if ab is None else ab;ba=flow(b,a) if ba is None else ba;yy,xx=np.indices((H,W),dtype=np.float32)
 def warp(im,f,t):
  mx,my=xx-t*f[...,0],yy-t*f[...,1]
  for _ in range(2):
   ff=cv2.remap(f,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE);mx,my=xx-t*ff[...,0],yy-t*ff[...,1]
  rgba=im.astype(np.float32)/255;rgba[...,:3]*=rgba[...,3:4]
  return cv2.remap(rgba,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
 rgba=(1-t)*warp(a,ab,t)+t*warp(b,ba,1-t);rgba[...,:3]/=np.maximum(rgba[...,3:4],1e-5);return np.uint8(np.clip(rgba*255,0,255))
def join(a,b,n=8):
 ab,ba=flow(a,b),flow(b,a)
 for t in np.linspace(0,1,n):yield blend(a,b,float(t*t*(3-2*t)),ab,ba)
def encode(name,frames,fps,w=W,h=H):
 target=OUT/f'{name}.mp4';count=0
 p=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{w}x{h*2}','-r',str(fps),'-i','-','-c:v','libx264','-threads','2','-preset','medium','-crf','12','-bf','0','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(target)],stdin=subprocess.PIPE)
 for a in frames:
  a=a[:h,:w];p.stdin.write(np.vstack([a[...,:3],np.repeat(a[...,3:4],3,axis=2)]).tobytes());count+=1
 p.stdin.close();assert p.wait()==0
 return {'src':f'review/astrid-seam-repair/{name}-{sha(target)[:12]}.mp4','sha256':sha(target),'fps':fps,'frames':count,'file':target.name}
def flowmap(name,a,b):
 encoded=[]
 for f in [flow(a,b),flow(b,a)]:
  small=cv2.resize(f,(W//2,H//2),interpolation=cv2.INTER_AREA);e=np.full((H//2,W//2,3),255,np.uint8);e[...,:2]=np.clip(np.round(small*2+128),0,255).astype(np.uint8);encoded.append(e)
 p=OUT/f'{name}.png';Image.fromarray(np.vstack(encoded)).save(p)
 return {'flow':p.name,'sha256':sha(p),'src':f'review/astrid-seam-repair/{name}-{sha(p)[:12]}.png'}
files=[];after={};sheet=Image.new('RGB',(200*7,370),'#222');draw=ImageDraw.Draw(sheet)
def preview(name,a,i):
 after[name]=fit(a);after[name]['remainingGain']=grade(a)
 rgb=np.uint8(a[:,:,:3]*(a[:,:,3:4]/255)+35*(1-a[:,:,3:4]/255));sheet.paste(Image.fromarray(rgb).crop((285,20,535,420)).resize((200,320)),(i*200,35));draw.text((i*200+3,7),name,fill='white')
preview('ready',ref,0)
if '--speech-only' not in sys.argv:
 rest=[transform(a,cal['rest']) for a in packed_frames(idle['rest']['loop']['src'])]
 # Crossfade corresponding moving frames over 0.5s, then keep the native body
 # motion. The wrap is native frame60 -> frame61, not last -> first or reversal.
 overlap=12;tail=len(rest)-overlap
 loop=[blend(rest[tail+j],rest[j],(j/(overlap-1))**2*(3-2*j/(overlap-1))) for j in range(overlap)]+rest[overlap:tail]
 preview('folded-rest',loop[0],1)
 # Drop old endpoint joins, retain every native hand-motion frame 40..96.
 bridge=[transform(a,cal['bridge']) for a in packed_frames(idle['rest']['out']['src'])][6:-6]
 out=list(join(loop[0],bridge[0]))+bridge+list(join(bridge[-1],ref))
 back=list(reversed(out));preview('bridge',bridge[len(bridge)//2],2)
 for name,frames,fps in [('loop',loop,24),('out',out,36),('back',back,36)]:
  info=encode(name,frames,fps);files.append(info);old=idle['rest'][name];idle['rest'][name]={**old,**{k:v for k,v in info.items() if k!='file'},'calibrationRevision':'seam-repair-v1'};print(name,info['frames'],flush=True)
 idle['rest']['automaticGlances']=False
 idle['rest']['note']='Fixed measured uniform actor scale/translation and per-take RGB balance. Folded loop uses a 12-frame motion-aligned moving overlap; wrap is adjacent native frames60->61 of the previous trimmed loop. Out starts on the exact loop entry; return ends there. Speech exits the loop only at that boundary. The folded native loop provides breathing and subtle eyes without extra full head-turn clips.'
 (OUT/'rest.json').write_text(json.dumps(idle['rest'],indent=2)+'\n')
else:
 idle['rest']=json.loads((OUT/'rest.json').read_text())
 for name in ['loop','out','back']:files.append({**idle['rest'][name],'file':f'{name}.mp4'})
# All speech frames retain frame count and native fps, with a fixed grade per
# recording (no histogram matching that can pump from frame to frame).
for ix,(name,line) in enumerate(speak['lines'].items()):
 m=line['media'];src=PUB/m['src'];assert sha(src)==m['sha256'];c={**cal[name],**{k:cal[name]['samples'][0][k] for k in ['scale','offset']}};w,h=m['width'],m['height']
 # The common initial plate is the geometric anchor. Speech endpoints may
 # lean/turn and have sparse features, so they must not set a new actor size.
 def frames():
  for a in packed_frames(m['src'],20):
   b=transform(a,c)
   # ActorOffset is still applied by the player; remove it in the encoded crop.
   yield cv2.warpAffine(b,np.float32([[1,0,0],[0,1,-20]]),(W,H))
 info=encode(name,frames(),m['fps'],w,h);files.append(info);assert info['frames']==m['frames']
 m['parentPackedSha256']=m['sha256'];m['src']=info['src'];m['sha256']=info['sha256'];m['displayCalibration']={**{k:c[k] for k in ['scale','offset','gain']},'space':'common crop after actorOffset','revision':'seam-repair-v1','referenceSha256':idle['base']['sha256']}
 first=read(OUT/info['file'],0,20);last=read(OUT/info['file'],m['frames']-1,20)
 line['transition']={'width':W,'height':H,'durationMs':220,'flowRange':64,'actorOffset':speak['actorOffset'],'idleSha256':idle['base']['sha256'],'mediaSha256':m['sha256'],'method':'Fixed uniform registration and RGB calibration, then bidirectional DIS whole-actor silent join. Native speech frames and exact mp3 timing retained. New visual review required.','enter':flowmap(name+'-enter',ref,first),'exit':flowmap(name+'-exit',last,ref)}
 if name in ['greeting','goodluck','insurance','win']:preview(name,first,{'greeting':3,'goodluck':4,'insurance':5,'win':6}[name])
 print(name,'calibrated',info['frames'],'native frames',flush=True)
speak['spliceMeasurement']['note']='Source registration and actorOffset remain bound to the original take. The display copy adds the fixed uniform transform and RGB gain recorded in media.displayCalibration; entry/exit maps are measured from those calibrated pixels.'
speak['visualRevision']='seam-repair-v1';speak['approval']='Review revision: fixed per-source color and uniform registration. Previous mask approval does not imply approval of these display copies.'
speak['note']='Each original recording and its mp3 stay unchanged on disk. The display copy applies one fixed measured RGB grade and uniform scale/translation, retaining native fps, frame count and audio offset. Joins are remeasured against the calibrated display copies. No generated replacement or per-frame color pumping.'
(OUT/'idle.json').write_text(json.dumps(idle,indent=2)+'\n');(OUT/'speak.json').write_text(json.dumps(speak,indent=2)+'\n');(OUT/'files.json').write_text(json.dumps(files,indent=2)+'\n');(HERE/'after-measurements.json').write_text(json.dumps(after,indent=2)+'\n');sheet.save(HERE/'after-compare.jpg',quality=95)
print('Built calibrated display revision; not installed.',flush=True)
