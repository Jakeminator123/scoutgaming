from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib,subprocess
p=Path(__file__).resolve().parent;base=p.parent;(p/'rg').mkdir(exist_ok=True)
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
rows=[]
for n in range(110):
 rgb=base/'camera-mattes/frames'/f'{n:04d}.png'
 if n<40:
  src=base/'camera-paper-first/manual-v3/rg'/f'{n:04d}.png';a=np.array(Image.open(src).convert('RGB'));kind='manual-v3-first40';valid=True
 else:
  src=base/('camera-fifth-paper/r' if n>=107 else 'camera-composite/r-edge-clean')/f'{n:04d}.png';r=np.array(Image.open(src).convert('L'));a=np.stack([r,np.zeros_like(r),np.zeros_like(r)],axis=2);kind='fifth-paper-R' if n>=107 else 'edge-R';valid=False
 out=p/'rg'/f'{n:04d}.png';Image.fromarray(a).save(out)
 rows.append({'nativeFrame':n,'kind':kind,'handMaskValid':valid,'rgbSHA256':sha(rgb),'maskInput':str(src.relative_to(base)),'maskInputSHA256':sha(src),'packedMaskSHA256':sha(out)})
 out=None
out=p/'camera-working-native.mp4'
cmd=['ffmpeg','-v','error','-y','-framerate','24','-start_number','0','-i',str(base/'camera-mattes/frames/%04d.png'),'-framerate','24','-start_number','0','-i',str(p/'rg/%04d.png'),'-filter_complex','[0:v][1:v]vstack=inputs=2[v]','-map','[v]','-frames:v','110','-an','-c:v','libx264','-crf','14','-pix_fmt','yuv420p','-bf','0','-movflags','+faststart',str(out)]
subprocess.run(cmd,check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_frames','-show_streams','-show_entries','frame=best_effort_timestamp_time:stream=width,height,r_frame_rate,nb_frames','-of','json',str(out)]))
assert len(probe['frames'])==110
assert all(abs(float(f['best_effort_timestamp_time'])-n/24)<.000002 for n,f in enumerate(probe['frames']))
(p/'receipt.json').write_text(json.dumps({'status':'WORKING DRAFT: first40 contact only; later G unapproved, fifth paper removed107–109','sourceSHA256':sha(base/'camera-locked.mp4'),'outputSHA256':sha(out),'frameCount':110,'fps':24,'layout':'vertical1920x2160 topRGB bottomRG; force G off after39','frames':rows,'probe':probe['streams'],'command':cmd},indent=2)+'\n')
