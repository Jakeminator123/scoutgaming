from pathlib import Path
import json,subprocess,sys
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2
p=Path(__file__).resolve().parent;base=p.parent.parent
observations=json.loads((p.parent/'slide-contact/observations.json').read_text())['frames']
review=[]
for r in observations[32:55]:
 review.append({'frame':r['frame'],'reviewedIndexCandidateNative':r['fingerCandidateNative'],'correctionNative':[0,0],'contactMeasured':False,'identityReview':'appears to follow same outer/index tip in native crops; no anatomy synthesized','uncertaintyPixels':5 if r['frame']<36 else 4,'confidence':'medium image-position review; physical contact unapproved'})
(p/'reviewed-index32-54.json').write_text(json.dumps(review,indent=2)+'\n')
prop=np.asarray(Image.open(p.parent/'card-cleanup/frozen-source-Q-placeholder.png').convert('RGBA'));ph,pw=prop.shape[:2]
path=base/'low-turn/compositor-viewer/slide-packed-draft.mp4'
proc=subprocess.Popen(['ffmpeg','-v','error','-i',str(path),'-frames:v','55','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
tiles=[]
for n in range(55):
 raw=proc.stdout.read(1920*2160*3);assert len(raw)==1920*2160*3
 if n<32 or (n-32)%2:continue
 frame=np.frombuffer(raw,np.uint8).reshape(2160,1920,3);rgb=frame[:1080].astype(np.float32);a=frame[1080:,:,0:1].astype(np.float32)/255;g=np.minimum(a,frame[1080:,:,1:2].astype(np.float32)/255)
 back=(a-g)/np.maximum(1-g,.00001);out=rgb*back+np.array([38,51,54])*(1-back)
 x,y=observations[n]['fingerCandidateNative'];dx=x-1075;dy=y-620
 # Exactly the authored fixed-size parallelogram currently used by root viewer.
 m=np.float32([[57/pw,27/ph,1052+dx],[-7/pw,31/ph,619+dy]])
 warped=cv2.warpAffine(prop,m,(1920,1080));pa=warped[:,:,3:4].astype(np.float32)/255
 out=out*(1-pa)+warped[:,:,:3]*pa;out=out*(1-g)+rgb*g
 image=Image.fromarray(np.clip(np.rint(out),0,255).astype(np.uint8))
 tile=image.crop((850,680,1040,855)).resize((380,350));panel=Image.new('RGB',(380,375),'#171717');panel.paste(tile,(0,0));ImageDraw.Draw(panel).text((8,355),f'n{n} fixed SOURCE Q / original finger matte',fill='white');tiles.append(panel)
assert proc.wait()==0
sheet=Image.new('RGB',(1520,1125),'#171717')
for j,tile in enumerate(tiles):sheet.paste(tile,(j%4*380,j//4*375))
sheet.save(p/'constant-prop-finger-review.jpg',quality=95)
