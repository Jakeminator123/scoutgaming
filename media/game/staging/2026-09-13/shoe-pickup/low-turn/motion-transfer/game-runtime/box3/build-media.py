"""Stream original169-pack top RGB and reviewed mask candidates into one native-clock atlas."""
from pathlib import Path
import hashlib,json,subprocess,os,shutil
import numpy as np
from PIL import Image

here=Path(__file__).resolve().parent
root=next(p for p in here.parents if (p/'web/public').is_dir())
video=root/'web/public/dealers/astrid/performance/centre-native-review.mp4'
rawSource=root/'content/staging/2026-09-09/contact-proof/source.mp4'
rgdir=here/'masks/selected85'
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
pace=json.loads((here/'pace/receipt.json').read_text());masks=json.loads((rgdir/'receipt.json').read_text())
assert digest(video)==pace['sourceSHA256']=='7ccca94b5332f28cdd962fd70d34ac59152aecbac4748738bf53ac87331a7726'
assert digest(rawSource)=='fdc1edca5671b88ccee6906746614c15b1e2b26bdabc83342b8505e0c97272c9'
assert masks['paceReceiptSHA256']==digest(here/'pace/receipt.json')
assert len(pace['frames'])==len(masks['frames'])==85
assert shutil.disk_usage(here).free>256*1024**2
rows=[];bounds=[]
for n,(clock,mr) in enumerate(zip(pace['frames'],masks['frames'])):
 assert clock['outputFrame']==mr['outputFrame']==n and clock['packedNative']==mr['packedNative']
 p=rgdir/f'{n:04d}.png';assert digest(p)==mr['sha256']
 with Image.open(p) as im:
  assert im.size==(1280,720)
  m=np.array(im.convert('RGB'));assert np.all(m[:,:,1]<=m[:,:,0])
  yy,xx=np.where(m[:,:,0]>0);assert len(xx)>0
  bounds.append((int(xx.min()*1.5),int(yy.min()*1.5),int(np.ceil((xx.max()+1)*1.5)),int(np.ceil((yy.max()+1)*1.5))))
 rows.append({**clock,'frame':n,'maskSHA256':digest(p)})
x=max(0,(min(b[0] for b in bounds)-16)//2*2)
y=max(0,(min(b[1] for b in bounds)-16)//2*2)
right=min(1920,(max(b[2] for b in bounds)+17)//2*2)
bottom=min(1080,(max(b[3] for b in bounds)+17)//2*2)
w,h=right-x,bottom-y
ffmpeg=shutil.which('ffmpeg');assert ffmpeg
out=here/'actor-gray.mp4';tmp=here/'actor-gray.build.mp4'
decoder=subprocess.Popen([ffmpeg,'-v','error','-threads','1','-i',str(video),'-vf','crop=1920:1080:0:0','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
encoder=subprocess.Popen([ffmpeg,'-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{w}x{h*3}','-r','60','-i','-','-an','-c:v','libx264','-threads','1','-preset','fast','-profile:v','high','-crf','14','-pix_fmt','yuv420p','-movflags','+faststart',str(tmp)],stdin=subprocess.PIPE)
try:
 current=-1;raw=None
 for row in rows:
  assert row['packedNative']>=current
  while current<row['packedNative']:
   raw=decoder.stdout.read(1920*1080*3);current+=1;assert len(raw)==1920*1080*3,f'Missing packed frame {current}'
  rgb=np.frombuffer(raw,dtype=np.uint8).reshape(1080,1920,3)[y:bottom,x:right]
  row['nativeDecodedRGBSHA256']=hashlib.sha256(raw).hexdigest()
  with Image.open(rgdir/f'{row["frame"]:04d}.png') as im:m=np.array(im.convert('RGB').resize((1920,1080),Image.Resampling.BILINEAR))[y:bottom,x:right]
  r=m[:,:,0].astype(np.float32)/255;front=m[:,:,1].astype(np.float32)/255
  rear=np.divide(r-front,1-front,out=np.zeros_like(r),where=front<1)
  plane=lambda a:np.repeat(np.floor(np.clip(a,0,1)*255+.5).astype(np.uint8)[:,:,None],3,axis=2)
  encoder.stdin.write(np.concatenate([rgb,plane(rear),plane(front)]).tobytes())
 while decoder.stdout.read(1920*1080*3):pass # consume unused tail without storing
 encoder.stdin.close();assert decoder.wait()==0;assert encoder.wait()==0
finally:
 for proc in (decoder,encoder):
  if proc.poll() is None:proc.terminate();proc.wait()
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=width,height,nb_read_frames,r_frame_rate','-of','json',str(tmp)]))['streams'][0]
assert int(probe['nb_read_frames'])==85 and probe['r_frame_rate']=='60/1'
assert (probe['width'],probe['height'])==(w,h*3)
os.replace(tmp,out)
receipt={'sourceSha256':digest(video),'rawSourceSHA256':digest(rawSource),'maskReceiptSHA256':digest(rgdir/'receipt.json'),'paceReceiptSHA256':digest(here/'pace/receipt.json'),'outputSHA256':digest(out),'frameCount':85,'fps':60,'nativeFps':24,'crop':[x,y,w,h],
 'layout':'RGB top, precomputed grayscale rear middle, grayscale hand foreground bottom',
 'status':'UNAPPROVED box3 whole-action mask candidate; requires actual gameplay visual review',
 'encoding':'Native RGB unchanged before lossy High420 CRF14 encoding. Selected packedNative from explicit85-frame pace ledger; original topRGB only.1280 masks uniformly upsampled1.5; no new detail.',
 'rows':rows,'bytes':out.stat().st_size}
(here/'media-receipt.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps({k:v for k,v in receipt.items() if k!='rows'}))
