from pathlib import Path
import subprocess,json,hashlib
import numpy as np
from PIL import Image,ImageDraw
D=Path(__file__).resolve().parent;source=D.parent/'camera-locked.mp4';repo=D.parents[6]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=width,height,r_frame_rate,nb_read_frames:format=duration','-of','json',str(source)],text=True))
pts=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',str(source)],text=True))['frames']
assert len(pts)==121
assert all(abs(float(f['best_effort_timestamp_time'])-i/24)<.000002 for i,f in enumerate(pts))
(D/'timestamps.json').write_text(json.dumps(pts,indent=2)+'\n')
expected=[f'{i:04d}.png' for i in range(121)];hashes={};stats=[]
for kind in ['frames','person']:
 files=sorted((D/kind).glob('*.png'));assert [f.name for f in files]==expected
 hashes[kind]={}
 for p in files:
  im=Image.open(p);assert im.size==(1920,1080),(p,im.size)
  hashes[kind][p.name]=sha(p)
  if kind=='person':
   a=np.array(im.convert('L'));stats.append({'frame':int(p.stem),'nonzero':int((a>0).sum()),'above127':int((a>127).sum())})
(D/'frame-shas.json').write_text(json.dumps(hashes,indent=2)+'\n')
(D/'receipt.json').write_text(json.dumps({'status':'raw Vision masks, not cleaned compositor RG','sourceSHA256':sha(source),'scriptSHA256':sha(repo/'pipeline/person-mask.swift'),'probe':probe,'assertions':{'frames':121,'masks':121,'naming':'0000.png–0120.png','dimensions':[1920,1080],'pts':'all n/24 within2microseconds'},'coverage':stats},indent=2)+'\n')
samples=[0,8,18,23,35,42,58,67,74,87,98,110,118,120]
sheet=Image.new('RGB',(1440,270*len(samples)))
for row,n in enumerate(samples):
 rgb=Image.open(D/'frames'/f'{n:04d}.png').convert('RGB');mask=Image.open(D/'person'/f'{n:04d}.png').convert('L');bg=Image.new('RGB',rgb.size,(85,105,100));cut=Image.composite(rgb,bg,mask)
 for col,im in enumerate([rgb,mask.convert('RGB'),cut]):sheet.paste(im.resize((480,270)),(col*480,row*270))
 ImageDraw.Draw(sheet).text((5,row*270+5),f'n{n}',fill='yellow')
sheet.save(D/'review.jpg',quality=92)
# Hand detail without rescaling; source / mask / composited, same crop.
sheet=Image.new('RGB',(1800,280*6))
for row,n in enumerate([8,18,23,67,98,118]):
 rgb=Image.open(D/'frames'/f'{n:04d}.png').convert('RGB');m=Image.open(D/'person'/f'{n:04d}.png').convert('L');cut=Image.composite(rgb,Image.new('RGB',rgb.size,(90,110,100)),m)
 for col,im in enumerate([rgb,m.convert('RGB'),cut]):sheet.paste(im.crop((800,490,1400,770)),(col*600,row*280))
 ImageDraw.Draw(sheet).text((5,row*280+5),f'n{n}',fill='yellow')
sheet.save(D/'hand-detail.jpg',quality=95)
print('PASS:121 RGB +121 masks1920x1080, all timestamps n/24')
