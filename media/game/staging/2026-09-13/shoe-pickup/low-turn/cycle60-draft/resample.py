from pathlib import Path
import sys,json,hashlib,math,subprocess
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2
cv2.setNumThreads(1)
p=Path(__file__).resolve().parent;b=p.parent;clip=sys.argv[1] if len(sys.argv)>1 else 'pickup'
configs={'pickup':('source',7,66,b/'pickup-draft/pickup-rg'),'slide':('slide',2,54,b/'composite-draft/slide-rg'),'return':('return',5,36,b/'return-draft/rg')}
src,first,last,maskdir=configs[clip];out=p/clip;out.mkdir(exist_ok=True);(out/'frames').mkdir(exist_ok=True);(out/'flow').mkdir(exist_ok=True)
W,H=1920,1080;fw,fh=960,540;yy,xx=np.indices((H,W),dtype=np.float32);dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM);dis.setUseSpatialPropagation(True)
cache={};flows={};hashes={}
def read(n):
 if n not in cache:
  a=b/'mattes'/src/'frames'/f'{n+1:04d}.png';m=maskdir/f'{n:04d}.png';rgb=cv2.imread(str(a)).astype(np.float32)/255;rg=cv2.imread(str(m))[:,:,::-1].astype(np.float32)/255;alpha=rg[:,:,0];data=np.concatenate([rgb*alpha[:,:,None],rg[:,:,:2]],2);gray=cv2.resize(cv2.cvtColor(np.uint8(rgb*255),cv2.COLOR_BGR2GRAY),(fw,fh));cache[n]=(data,gray);hashes[n]={'rgb':hashlib.sha256(a.read_bytes()).hexdigest(),'rg':hashlib.sha256(m.read_bytes()).hexdigest()}
 return cache[n]
def flow(n):
 if n not in flows:
  a=read(n)[1];c=read(n+1)[1];f=dis.calc(a,c,None);rev=dis.calc(c,a,None);np.savez_compressed(out/'flow'/f'{n:04d}.npz',forward=f.astype(np.float16),backward=rev.astype(np.float16));flows[n]=(cv2.resize(f,(W,H))*2,cv2.resize(rev,(W,H))*2)
 return flows[n]
ledger=[];count=math.ceil((last-first)/.8)+1
for k in range(count):
 q=min(last,first+k*.8);n=int(math.floor(q+1e-8));t=q-n;a=read(n)[0]
 if t<1e-6:res=a.copy()
 else:
  c=read(n+1)[0];f,rev=flow(n);wa=cv2.remap(a,xx-t*f[:,:,0],yy-t*f[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT);wb=cv2.remap(c,xx-(1-t)*rev[:,:,0],yy-(1-t)*rev[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT);res=wa*(1-t)+wb*t
  disagreement=np.abs(wa[:,:,3]-wb[:,:,3])>.15
  res[disagreement]=(wa if t<.5 else wb)[disagreement]
 alpha=res[:,:,3];rgb=np.clip(res[:,:,:3]/np.maximum(alpha[:,:,None],1e-5),0,1);rg=np.stack([res[:,:,3],res[:,:,4],np.zeros_like(alpha)],2);packed=np.concatenate([np.uint8(rgb*255+.5),np.uint8(rg[:,:,::-1]*255+.5)],axis=1);cv2.imwrite(str(out/'frames'/f'{k:04d}.png'),packed)
 ledger.append({'outputFrame':k,'outputSeconds':k/60,'sourcePosition':q,'sourceFrames':[n,min(n+1,last)],'blend':t,'flowPair':n if t>1e-6 else None,'sharedRGBandRG':True})
 # Bound memory while preserving reusable next frame and flows.
 cache={a:v for a,v in cache.items() if a>=n};flows={a:v for a,v in flows.items() if a>=n}
subprocess.run(['ffmpeg','-v','error','-y','-framerate','60','-i',str(out/'frames/%04d.png'),'-c:v','libx264','-preset','fast','-crf','12','-bf','0','-pix_fmt','yuv444p','-movflags','+faststart',str(out/f'{clip}-shared60-packed.mp4')],check=True)
rec={'status':'staging interpolated60fps at2x, NOT native60 or accepted motion','clip':clip,'nativeFPS':24,'outputFPS':60,'speed':2,'first':first,'last':last,'frames':count,'sourceVideoSHA':hashlib.sha256((b/f'{src}.mp4').read_bytes()).hexdigest(),'inputFrameSHAs':hashes,'method':'bidirectional DIS flow at960x540, upsampled uniformly2x; same remap and blend for premultiplied RGB, actorR and foregroundG; actor-coverage disagreement>0.15 selects nearer warped source jointly for all channels; independent clips, no cross-boundary flow','flowStorage':'float16 audit fields; calculation uses float32; deterministic cv2 singlethread','packedLayout':'3840x1080 leftRGB rightRG, channels Ractor Ghand B0','ledger':ledger};(out/'ledger.json').write_text(json.dumps(rec,indent=2)+'\n');print(clip,count)
