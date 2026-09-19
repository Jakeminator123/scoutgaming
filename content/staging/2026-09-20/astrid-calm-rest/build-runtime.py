#!/usr/bin/env python3
"""Registered native actor motion with short, silent endpoint joins."""
import cv2,hashlib,json,subprocess,sys
import numpy as np
from pathlib import Path
from PIL import Image
HERE=Path(__file__).resolve().parent
REPO=HERE.parents[3];PUB=REPO/'web/public';W,H=960,760
OUT=HERE/'runtime';OUT.mkdir(exist_ok=True);cv2.setNumThreads(1)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
idle_path=PUB/'review/astrid-green-waiting/idle.json';idle=json.loads(idle_path.read_text())
def native(folder,indices,offset):
 m=json.loads((folder/'mask-face-repair/manifest.json').read_text());assert m['sourceSha256']==sha(folder/'source.mp4')
 for n in indices:
  rgb=np.asarray(Image.open(folder/'mask/frames'/f'{n:04d}.png').convert('RGB'))[:H,560:560+W]
  a=np.asarray(Image.open(folder/'mask-face-repair/alpha'/f'{n:04d}.png').convert('L'))[:H,560:560+W]
  dx,dy=offset(n);mat=np.float32([[1,0,dx],[0,1,dy]])
  yield cv2.warpAffine(np.dstack([rgb,a]),mat,(W,H))
def grey(a):
 rgb=a[...,:3]*(a[...,3:4]/255)+48*(1-a[...,3:4]/255)
 return cv2.cvtColor(rgb.astype(np.uint8),cv2.COLOR_RGB2GRAY)
def flow(a,b):
 dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM);dis.setUseSpatialPropagation(True)
 return np.clip(cv2.GaussianBlur(dis.calc(grey(a),grey(b),None),(5,5),1),-30,30)
def join(a,b,count=6):
 ab,ba=flow(a,b),flow(b,a);yy,xx=np.indices((H,W),dtype=np.float32)
 def warp(im,f,t):
  mx,my=xx-t*f[...,0],yy-t*f[...,1]
  for _ in range(2):
   ff=cv2.remap(f,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE);mx,my=xx-t*ff[...,0],yy-t*ff[...,1]
  rgba=im.astype(np.float32)/255;rgba[...,:3]*=rgba[...,3:4]
  return cv2.remap(rgba,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
 for t in np.linspace(0,1,count):
  t=float(t*t*(3-2*t));rgba=(1-t)*warp(a,ab,t)+t*warp(b,ba,1-t);rgba[...,:3]/=np.maximum(rgba[...,3:4],1e-5)
  yield np.uint8(np.clip(rgba*255,0,255))
def encode(name,frames,fps,source,source_frames):
 target=OUT/f'{name}.mp4';count=0
 cmd=['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H*2}','-r',str(fps),'-i','-','-c:v','libx264','-preset','slow','-crf','12','-bf','0','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(target)]
 process=subprocess.Popen(cmd,stdin=subprocess.PIPE)
 for a in frames:
  process.stdin.write(np.vstack([a[...,:3],np.repeat(a[...,3:4],3,axis=2)]).tobytes());count+=1
 process.stdin.close();assert process.wait()==0
 dest=PUB/'review/astrid-folded-rest'/f'{name}-{sha(target)[:12]}.mp4';dest.parent.mkdir(exist_ok=True);dest.write_bytes(target.read_bytes())
 return {'src':str(dest.relative_to(PUB)),'sha256':sha(target),'sourceSha256':sha(source),'fps':fps,'frames':count,'sourceFrames':source_frames}
loop_frames=list(native(HERE,range(72,145),lambda n:(19,25)))
loop=encode('loop',loop_frames,24,HERE/'source.mp4',[72,144])
bridge=HERE/'transition-v2';count=json.loads((bridge/'mask-face-repair/manifest.json').read_text())['frameCount']
offset=lambda n:(5.5134+(3.66446-5.5134)*n/(count-1),-9.31226+(-8.32402+9.31226)*n/(count-1))
# First 40 source frames hold the folded pose. Keep the full hand movement.
bridge_frames=list(native(bridge,range(40,count),offset))
cap=cv2.VideoCapture(str(PUB/idle['base']['src']));ok,b=cap.read();cap.release();assert ok
ready=np.dstack([cv2.cvtColor(b[:H],cv2.COLOR_BGR2RGB),b[H:H*2,:,0]])
frames=list(join(loop_frames[-1],bridge_frames[0]))+bridge_frames+list(join(bridge_frames[-1],ready))
out=encode('out',frames,36,bridge/'source.mp4',[40,count-1])
back=encode('back',reversed(frames),36,bridge/'source.mp4',[count-1,40])
rest={'version':1,'jobId':'744a9e34-944a-4788-9d81-a0e50bd20039','transitionJobId':'92521ca6-1037-498a-ad71-933248fcf253','readySha256':idle['base']['sha256'],'width':W,'height':H,'camera':idle['camera'],'loop':loop,'out':out,'back':back,'note':'Rest uses native frames72-144, excluding prolonged closed eyes at the start. Filmed empty-hand transition frames40-96 at36fps (1.5x), with six-frame silent endpoint joins, bidirectional DIS bounded30px. Return reverses this silent bridge. Rigid source x/y alignment: rest(+19,+25), bridge(+5.51,-9.31) to(+3.66,-8.32). No actor scaling or camera change. Speech assets unchanged.'}
(OUT/'rest.json').write_text(json.dumps(rest,indent=2)+'\n')
if '--install' not in sys.argv:
 print('Built staging rest.json; use --install to enable in gameplay.');sys.exit(0)
idle['rest']=rest;idle_path.write_text(json.dumps(idle,indent=2)+'\n')
config_path=REPO/'content/staging/2026-09-19/astrid-green-waiting/take-config.json'
config=json.loads(config_path.read_text());config['restManifest']='../../2026-09-20/astrid-calm-rest/runtime/rest.json';config_path.write_text(json.dumps(config,indent=2)+'\n')
print('Installed folded rest and registered native hand bridge.')
