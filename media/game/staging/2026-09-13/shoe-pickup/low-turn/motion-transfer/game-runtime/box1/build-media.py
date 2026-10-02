"""Stream original box1 RGB and reviewed mask candidates into one native-clock atlas."""
from pathlib import Path
import hashlib,json,subprocess,os,shutil
import numpy as np
from PIL import Image

here=Path(__file__).resolve().parent
source=here.parents[1]/'camera-review/seven-targets/box1-trial-spec'
rgdir=source/'card-pose-fit/hand-foreground-masks/rg'
video=source/'source.mp4'
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert digest(video)=='ac46fe3283544d40a7d80c6d9f7f1592fe4d9c566887a8abc73f250734419e0b'
assert shutil.disk_usage(here).free>256*1024**2
rows=[];bounds=[]
for n in range(97):
 p=rgdir/f'{n:04d}.png'
 with Image.open(p) as im:
  assert im.size==(1920,1080)
  m=np.array(im.convert('RGB'));assert np.all(m[:,:,1]<=m[:,:,0]),f'G exceeds R at {n}'
  yy,xx=np.where(m[:,:,0]>0)
  assert len(xx)>0
  bounds.append((int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)))
 rows.append({'frame':n,'native':n,'sourcePTS':n/24,'maskSHA256':digest(p)})
x=max(0,(min(b[0] for b in bounds)-16)//2*2)
y=max(0,(min(b[1] for b in bounds)-16)//2*2)
right=min(1920,(max(b[2] for b in bounds)+17)//2*2)
bottom=min(1080,(max(b[3] for b in bounds)+17)//2*2)
w,h=right-x,bottom-y
ffmpeg=shutil.which('ffmpeg');assert ffmpeg
out=here/'actor-gray.mp4';tmp=here/'actor-gray.build.mp4'
decoder=subprocess.Popen([ffmpeg,'-v','error','-threads','1','-i',str(video),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
encoder=subprocess.Popen([ffmpeg,'-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{w}x{h*3}','-r','60','-i','-','-an','-c:v','libx264','-threads','1','-preset','fast','-profile:v','high','-crf','14','-pix_fmt','yuv420p','-movflags','+faststart',str(tmp)],stdin=subprocess.PIPE)
try:
 for row in rows:
  raw=decoder.stdout.read(1920*1080*3);assert len(raw)==1920*1080*3,f'Missing source frame {row["frame"]}'
  rgb=np.frombuffer(raw,dtype=np.uint8).reshape(1080,1920,3)[y:bottom,x:right]
  row['nativeDecodedRGBSHA256']=hashlib.sha256(raw).hexdigest()
  with Image.open(rgdir/f'{row["frame"]:04d}.png') as im:m=np.array(im.convert('RGB'))[y:bottom,x:right]
  r=m[:,:,0].astype(np.float32)/255;front=m[:,:,1].astype(np.float32)/255
  rear=np.divide(r-front,1-front,out=np.zeros_like(r),where=front<1)
  plane=lambda a:np.repeat(np.floor(np.clip(a,0,1)*255+.5).astype(np.uint8)[:,:,None],3,axis=2)
  encoder.stdin.write(np.concatenate([rgb,plane(rear),plane(front)]).tobytes())
 assert not decoder.stdout.read(1),'Unexpected additional native source frame'
 encoder.stdin.close();assert decoder.wait()==0;assert encoder.wait()==0
finally:
 for proc in (decoder,encoder):
  if proc.poll() is None:proc.terminate();proc.wait()
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=width,height,nb_read_frames,r_frame_rate','-of','json',str(tmp)]))['streams'][0]
assert int(probe['nb_read_frames'])==97 and probe['r_frame_rate']=='60/1'
assert (probe['width'],probe['height'])==(w,h*3)
os.replace(tmp,out)
receipt={'sourceSha256':digest(video),'outputSHA256':digest(out),'frameCount':97,'fps':60,'nativeFps':24,'crop':[x,y,w,h],
 'layout':'RGB top, precomputed grayscale rear middle, grayscale hand foreground bottom',
 'status':'UNAPPROVED box1 source-specific mask candidate; requires actual gameplay visual review',
 'encoding':'Native RGB unchanged before lossy High420 CRF14 encoding. Every native frame retained; 2.5x time compression.',
 'rows':rows,'bytes':out.stat().st_size}
(here/'media-receipt.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps({k:v for k,v in receipt.items() if k!='rows'}))
