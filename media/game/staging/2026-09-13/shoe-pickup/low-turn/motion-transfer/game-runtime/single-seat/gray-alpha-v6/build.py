import sys;sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np,subprocess,json,hashlib
from pathlib import Path
cv2.setNumThreads(1)
here=Path(__file__).resolve().parent;motion=here.parents[2];source=motion/'camera-review/seven-targets/far-left-anchor/motion/release-continuation/motion-registration/full-cycle-candidate-v6';mappingSource=source.with_name('full-cycle-candidate-v5')/'web-surface/receipt.json';data=json.loads(mappingSource.read_text());out=here/'actor-rgb-rear-front-high14.mp4';x,y,w,h=352,64,1072,752
assert __import__('shutil').disk_usage(here).free>512*1024**2
cmd=['/opt/homebrew/bin/ffmpeg','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{w}x{h*3}','-r','60','-i','-','-an','-c:v','libx264','-threads','1','-preset','fast','-profile:v','high','-crf','14','-pix_fmt','yuv420p','-movflags','+faststart','-fs','134217728',str(out)]
def original(row):
 n=row['sequenceFrame'];rgb=cv2.cvtColor(cv2.imread(str(source/'actor-rgb'/f'{n:04d}.png')),cv2.COLOR_BGR2RGB)[y:y+h,x:x+w];mask=cv2.cvtColor(cv2.imread(str(source/'actor-rg'/f'{n:04d}.png')),cv2.COLOR_BGR2RGB)[y:y+h,x:x+w];r=mask[:,:,0].astype(np.float32)/255;g=mask[:,:,1].astype(np.float32)/255;front=np.minimum(r,g);rear=np.divide(r-front,1-front,out=np.zeros_like(r),where=(1-front)>0);return rgb,r,rear,front
if __name__=='__main__':
 proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
 for row in data['ledger']:
  rgb,r,rear,front=original(row);b=np.floor(rear*255+.5).astype(np.uint8);f=np.floor(front*255+.5).astype(np.uint8);packed=np.concatenate([rgb,np.repeat(b[:,:,None],3,axis=2),np.repeat(f[:,:,None],3,axis=2)]);proc.stdin.write(packed.tobytes())
 proc.stdin.close();assert proc.wait()==0;assert out.stat().st_size<134217728
 print(out)
