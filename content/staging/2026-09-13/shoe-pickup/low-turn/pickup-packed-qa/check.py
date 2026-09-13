from pathlib import Path
import subprocess,json,numpy as np
from PIL import Image,ImageDraw
p=Path(__file__).parent;r=p.parent;v=r/'compositor-viewer/pickup-packed-draft.mp4'
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames,pix_fmt:frame=best_effort_timestamp_time','-of','json',str(v)]));(p/'timestamps.json').write_text(json.dumps(probe,indent=2))
proc=subprocess.Popen(['ffmpeg','-v','error','-i',str(v),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
rows=[];samples=[54,55,58,61,66];sheet=Image.new('RGB',(1200,len(samples)*220),'#222');draw=ImageDraw.Draw(sheet)
for n in range(67):
 b=proc.stdout.read(1920*2160*3);assert len(b)==1920*2160*3
 a=np.frombuffer(b,np.uint8).reshape(2160,1920,3)[1080:];src=np.array(Image.open(r/'pickup-draft/pickup-rg'/f'{n:04}.png').convert('RGB'))
 rgbSource=np.array(Image.open(r/'mattes/source/frames'/f'{n+1:04}.png').convert('RGB'));decodedRGB=np.frombuffer(b,np.uint8).reshape(2160,1920,3)[:1080];record={'frame':n,'rgbMAE':float(np.abs(rgbSource.astype(float)-decodedRGB).mean())}
 for k,ch in enumerate('RG'):
  x=src[:,:,k].astype(float);y=a[:,:,k].astype(float);positive=x>127
  record[ch]={'mae':float(np.abs(x-y).mean()),'positivePixels':int(positive.sum()),'decodedPositivePixels':int((y>127).sum()),'lostAbove127':int((positive&(y<=127)).sum()),'gainedAbove127':int(((x<=127)&(y>127)).sum()),'meanLossOnPositive':float((x-y)[positive].mean()) if positive.any()else 0,'maxAbsError':float(np.abs(x-y).max())}
 rows.append(record)
 if n in samples:
  j=samples.index(n);box=(780,520,1280,920);x0,y0,x1,y1=box
  for c,im in enumerate([src,a,np.minimum(np.abs(src.astype(float)-a)*4,255).astype('uint8')]):
   crop=Image.fromarray(im).crop(box).resize((400,190));sheet.paste(crop,(c*400,j*220+25))
  draw.text((5,j*220+5),f'n{n} source RG | decoded RG | absolute error x4',fill='white')
assert not proc.stdout.read(1);assert proc.wait()==0
sheet.save(p/'rg-codec-review.jpg',quality=94)
ts=[float(x['best_effort_timestamp_time']) for x in probe['frames']];assert len(ts)==67;assert all(abs(t-i/24)<.000002 for i,t in enumerate(ts))
(p/'coverage.json').write_text(json.dumps({'frames':rows,'timestampsExact24fpsTolerance2us':True},indent=2));print(json.dumps([rows[i] for i in samples],indent=2))
import hashlib
(p/'input-sha256.json').write_text(json.dumps({'packed':hashlib.sha256(v.read_bytes()).hexdigest(),'maskFrames':{f'{n:04}':hashlib.sha256((r/'pickup-draft/pickup-rg'/f'{n:04}.png').read_bytes()).hexdigest() for n in range(67)}},indent=2))
