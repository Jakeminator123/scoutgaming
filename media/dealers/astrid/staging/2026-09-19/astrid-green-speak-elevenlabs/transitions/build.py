#!/usr/bin/env python3
"""Measure bidirectional whole-actor flow for short speech/idle transitions.

No speech frames, face pixels, audio, or camera are replaced. Maps are used
only between the held idle and the first/last frame of each existing take.
"""
import cv2, hashlib, json, sys
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent; REPO=ROOT.parents[3]; PUB=REPO/'web/public'
HERE.mkdir(exist_ok=True); cv2.setNumThreads(1)
W,H=960,760
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
idle=json.loads((PUB/'review/astrid-green-waiting/idle.json').read_text())
base_path=PUB/idle['base']['src']
assert sha(base_path)==idle['base']['sha256']
def packed_frame(path,n,w,h):
 v=cv2.VideoCapture(str(path));v.set(cv2.CAP_PROP_POS_FRAMES,n);ok,b=v.read();v.release();assert ok
 rgb=cv2.cvtColor(b[:h],cv2.COLOR_BGR2RGB);alpha=cv2.cvtColor(b[h:h*2],cv2.COLOR_BGR2GRAY)
 a=np.zeros((H,W,4),np.uint8);a[:h,:w,:3]=rgb;a[:h,:w,3]=alpha;return a
base=packed_frame(base_path,0,W,H)
alignment=json.loads((ROOT/'registration/actor-offset.json').read_text())
assert alignment['idleSha256']==sha(base_path),'actor offset needs remeasurement for this idle'
offset=alignment['offset']
def grey(a):
 # Dark neutral backing prevents the keyed green from driving flow.
 rgb=a[...,:3]*(a[...,3:4]/255)+48*(1-a[...,3:4]/255)
 return cv2.cvtColor(rgb.astype(np.uint8),cv2.COLOR_RGB2GRAY)
def flow(a,b):
 dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
 dis.setUseSpatialPropagation(True)
 f=dis.calc(grey(a),grey(b),None)
 f=cv2.GaussianBlur(f,(5,5),1)
 # The existing sources are registered; large vectors mean an unreliable
 # match in the empty background, not permission to change the camera.
 f=np.clip(f,-60,60)
 return f
def interpolate(a,b,ab,ba,t):
 yy,xx=np.indices((H,W),dtype=np.float32)
 def warp(im,f,amount):
  mx,my=xx-amount*f[...,0],yy-amount*f[...,1]
  for _ in range(2):
   ff=cv2.remap(f,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
   mx,my=xx-amount*ff[...,0],yy-amount*ff[...,1]
  rgba=im.astype(np.float32)/255;rgba[...,:3]*=rgba[...,3:4]
  return cv2.remap(rgba,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
 rgba=(1-t)*warp(a,ab,t)+t*warp(b,ba,1-t)
 rgba[...,:3]/=np.maximum(rgba[...,3:4],1e-5)
 return np.uint8(np.clip(rgba*255,0,255))
jobs={'greeting':ROOT,**{k:ROOT/'lines'/k for k in json.loads((ROOT/'jobs.json').read_text())}}
for line in sys.argv[1:] or jobs:
 d=jobs[line]; mask=d/'mask-face-repair'
 if line=='greeting':mask=d/'mask'
 m=json.loads((mask/'manifest.json').read_text());cw,ch=m['crop'][2:]
 assert m['crop'][:2]==[560,0]
 info={'width':W,'height':H,'durationMs':220,'flowRange':64,'actorOffset':offset,'idleSha256':sha(base_path),'mediaSha256':m['actorPackedSha256'],'method':'Rigid speech actor offset, then bidirectional DIS flow over the keyed actor, bounded to 60 source pixels. Premultiplied interpolation; no camera transform.'}
 for part,n in [('enter',0),('exit',m['frameCount']-1)]:
  speak=packed_frame(mask/'actor-packed.mp4',n,cw,ch)
  speak=cv2.warpAffine(speak,np.float32([[1,0,offset[0]],[0,1,offset[1]]]),(W,H),flags=cv2.INTER_LINEAR)
  a,b=(base,speak) if part=='enter' else (speak,base)
  ab,ba=flow(a,b),flow(b,a)
  encoded=[]
  for f in [ab,ba]:
   small=cv2.resize(f,(W//2,H//2),interpolation=cv2.INTER_AREA)
   e=np.full((H//2,W//2,3),255,np.uint8);e[...,:2]=np.clip(np.round(small*2+128),0,255).astype(np.uint8);encoded.append(e)
  p=HERE/f'{line}-{part}-flow.png';Image.fromarray(np.vstack(encoded)).save(p)
  info[part]={'flow':p.name,'sha256':sha(p)}
  sheet=Image.new('RGB',(1075,280),'#222222');draw=ImageDraw.Draw(sheet)
  for j,t in enumerate([0,.25,.5,.75,1]):
   rgba=interpolate(a,b,ab,ba,t);aa=rgba[...,3:4]/255
   comp=np.uint8(rgba[...,:3]*aa+np.array([46,43,37])*(1-aa))
   crop=Image.fromarray(comp).crop((295,15,510,270));sheet.paste(crop,(j*215,25));draw.text((j*215+5,5),f'{line} {part} {t:.2f}',fill='white')
  sheet.save(HERE/f'{line}-{part}-qa.jpg',quality=95)
 (HERE/f'{line}.json').write_text(json.dumps(info,indent=2)+'\n')
 print(line,'transitions measured',flush=True)
