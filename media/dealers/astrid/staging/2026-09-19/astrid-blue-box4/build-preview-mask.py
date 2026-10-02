"""Key the authorised live experiment, retaining skin over the blue prop."""
from pathlib import Path
import json, hashlib, importlib.util, subprocess
import cv2, numpy as np
from PIL import Image
D=Path(__file__).resolve().parent
REPO=D.parents[3]
PREP=D.parent/'astrid-elevated-camera/mask-prep'
M=D/'preview-mask';M.mkdir(exist_ok=True)
F=D/'source-review/frames'
for s in ['vision','alpha','qa']:(M/s).mkdir(exist_ok=True)
subprocess.run([str(REPO/'pipeline/person-mask'),str(F),str(M/'vision')],check=True)
spec=importlib.util.spec_from_file_location('approved_key',PREP/'key.py')
key=importlib.util.module_from_spec(spec);spec.loader.exec_module(key)
settings=json.loads((PREP/'settings.json').read_text())
evidence=json.loads((D/'source-review/evidence.json').read_text())
union=[1920,1080,0,0]
for f in evidence['frames']:
    n=f['frame'];name=f'{n:04}.png'
    rgb=np.array(Image.open(F/name).convert('RGB'))
    person=np.array(Image.open(M/'vision'/name).convert('L'))
    alpha=key.actor_alpha(rgb,settings,person)
    card=np.zeros(alpha.shape,np.uint8)
    for body in f['blueBodies']:
        cv2.fillConvexPoly(card,np.array(body['hull'],np.int32),255)
    card=cv2.dilate(card,np.ones((9,9),np.uint8))
    r,g,b=rgb.astype(float).transpose(2,0,1)
    skin=(r>g+8)&(r>b+18)&(r>70)&(g>35)
    alpha[(card>0)&~skin]=0
    # The edge-on blur has no blue component: remove non-skin in its measured
    # card neighbourhood, leaving the real touching fingers as foreground.
    if n==28:
        region=np.zeros_like(card);cv2.fillConvexPoly(region,np.array([[1090,641],[1176,614],[1198,622],[1102,655]],np.int32),255)
        alpha[(region>0)&~skin]=0
    Image.fromarray(alpha).save(M/'alpha'/name)
    yy,xx=np.where(alpha>0)
    union=[min(union[0],int(xx.min())),min(union[1],int(yy.min())),max(union[2],int(xx.max()+1)),max(union[3],int(yy.max()+1))]
    if n in [0,24,28,31,43,55,96]:
        rgba=np.dstack([rgb,alpha]);Image.fromarray(rgba).save(M/'qa'/f'{n:04}.png')
crop=[560,0,960,800]
assert union[0]>=560 and union[1]>=0 and union[2]<=1520 and union[3]<=800,union
subprocess.run(['ffmpeg','-v','error','-y','-framerate','24','-start_number','0','-i',str(F/'%04d.png'),
 '-framerate','24','-start_number','0','-i',str(M/'alpha/%04d.png'),
 '-filter_complex','[0:v]crop=960:800:560:0,format=yuv420p[rgb];[1:v]crop=960:800:560:0,format=yuv420p[a];[rgb][a]vstack=inputs=2[v]',
 '-map','[v]','-c:v','libx264','-preset','fast','-crf','15','-bf','0','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(M/'actor-packed.mp4')],check=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest={'crop':crop,'sourceSha256':sha(D/'source.mp4'),'actorPackedSha256':sha(M/'actor-packed.mp4'),
 'frameCount':97,'fps':'24/1','actorUnionBounds':union,'rgbPolicy':'Source RGB unchanged before encoding',
 'maskPolicy':'Approved green key + person semantic matte; blue hull/border removed except skin; grayscale alpha also supplies foreground fingers',
 'status':'User-requested live experiment, not visual acceptance'}
(M/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest))
