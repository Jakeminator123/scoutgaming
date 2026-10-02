"""Endpoint and motion samples for the fixed-frame bridge. Never approves it."""
from pathlib import Path
from PIL import Image,ImageDraw
import subprocess,json
import numpy as np
ROOT=Path(__file__).resolve().parent
source=ROOT/'return-source.mp4'
p=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,nb_read_frames,r_frame_rate','-of','json',str(source)]))['streams'][0]
n=int(p['nb_read_frames']);indices=sorted(set([0,n-1]+[round((n-1)*i/11) for i in range(12)]))
(ROOT/'review-frames').mkdir(exist_ok=True)
for i in indices:
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-vf',f'select=eq(n\\,{i})','-frames:v','1',str(ROOT/f'review-frames/{i:04}.png')],check=True)
sheet=Image.new('RGB',(930,4*250),'#151515');d=ImageDraw.Draw(sheet)
for j,i in enumerate(indices):
    im=Image.open(ROOT/f'review-frames/{i:04}.png');im.thumbnail((310,225))
    x,y=j%3*310,j//3*250;sheet.paste(im,(x,y));d.text((x+6,y+227),f'frame {i}',fill='white')
sheet.save(ROOT/'motion-sheet.jpg')
metrics=[]
for i,ref in [(0,'centre-endpoint.png'),(n-1,'idle-endpoint.png')]:
    a=Image.open(ROOT/ref).convert('RGB');b=Image.open(ROOT/f'review-frames/{i:04}.png').convert('RGB')
    # Backend letterboxes the custom crop into 4:3. Remove that padding,
    # rather than vertically squeezing Astrid to fit the requested crop.
    h=b.width*a.height/a.width;y=(b.height-h)/2
    b=b.crop((0,round(y),b.width,round(y+h))).resize(a.size,Image.Resampling.LANCZOS)
    a,b=np.asarray(a,dtype=float),np.asarray(b,dtype=float);roi=(a.max(axis=2)>25)|(b.max(axis=2)>25)
    metrics.append({'frame':i,'reference':ref,'foregroundMeanAbsoluteRGBError':float(np.abs(a-b)[roi].mean()),'foregroundPixelCount':int(roi.sum())})
(ROOT/'endpoint-metrics.json').write_text(json.dumps({'probe':p,'endpoints':metrics,'status':'diagnostic-only','limitation':'Colour/resize error is not anatomy, temporal motion or gameplay acceptance.'},indent=2))
