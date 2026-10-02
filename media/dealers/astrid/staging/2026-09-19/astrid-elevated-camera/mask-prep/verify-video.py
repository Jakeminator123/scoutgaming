#!/usr/bin/env python3
"""Verify native alpha/RGB and inspect decoded elevated-atlas samples."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw

ap=argparse.ArgumentParser()
ap.add_argument('--dir',type=Path,default=Path(__file__).resolve().parent/'video')
a=ap.parse_args()
d=a.dir.resolve()
m=json.loads((d/'manifest.json').read_text())
assert hashlib.sha256((d/'actor-packed.mp4').read_bytes()).hexdigest()==m['actorPackedSha256']
different=0
marker_max=0
face_min=255
background_max=0
shoe_max=0
all_bounds=[]
for row in m['frames']:
    name=f"{row['frame']:04d}.png"
    rgb=np.asarray(Image.open(d/'frames'/name).convert('RGB'))
    rgba=np.asarray(Image.open(d/'rgba'/name).convert('RGBA'))
    alpha=np.asarray(Image.open(d/'alpha'/name).convert('L'))
    assert np.array_equal(alpha,rgba[...,3])
    different+=int(np.count_nonzero(rgb!=rgba[...,:3]))
    r,g,b=rgb.astype(np.float32).transpose(2,0,1)
    yy=np.indices(alpha.shape)[0]
    marker=(r>125)&(b>75)&(r-g>30)&(b-g>8)&(b>g*1.15)&(yy>.28*alpha.shape[0])
    marker_max=max(marker_max,int(alpha[marker].max(initial=0)))
    face_min=min(face_min,int(alpha[105:205,927:1000].min()))
    background_max=max(background_max,int(alpha[:,:550].max()),int(alpha[760:,:].max()))
    shoe_max=max(shoe_max,int(alpha[550:650,1360:1480].max()))
    all_bounds.append(row['alphaBounds'])
assert different==0
assert marker_max==0
assert face_min==255
assert background_max==0
assert shoe_max==0
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0',
    '-show_entries','stream=width,height,avg_frame_rate,nb_read_frames,has_b_frames','-of','json',str(d/'actor-packed.mp4')]))['streams'][0]
assert [probe['width'],probe['height']]==m['packedDimensions']
assert int(probe['nb_read_frames'])==m['frameCount']
assert probe['avg_frame_rate']==m['fps']
assert probe['has_b_frames']==0
x,y,cw,ch=m['crop']
samples=[0,16,36,96]
sheet=Image.new('RGB',(1440,1600),'#25282b')
draw=ImageDraw.Draw(sheet)
cap=cv2.VideoCapture(str(d/'actor-packed.mp4'))
decoded=[]
for k,n in enumerate(samples):
    cap.set(cv2.CAP_PROP_POS_FRAMES,n)
    ok,bgr=cap.read()
    assert ok
    packed=cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB)
    rgb=packed[:ch]
    alpha=packed[ch:,:,0].astype(float)/255
    native_rgb=np.asarray(Image.open(d/'frames'/f'{n:04d}.png').convert('RGB'))[y:y+ch,x:x+cw]
    native_a=np.asarray(Image.open(d/'alpha'/f'{n:04d}.png').convert('L'))[y:y+ch,x:x+cw]/255
    roi=(slice(105-y,205-y),slice(927-x,1000-x))
    decoded.append({'frame':n,'faceEncodedRgbMae':float(abs(rgb[roi].astype(float)-native_rgb[roi]).mean()),
                    'alphaMeanAbsoluteError':float(abs(alpha-native_a).mean())})
    yy,xx=np.indices(alpha.shape)
    checker=np.where(((xx//24+yy//24)%2)[...,None],[54,59,64],[36,41,46])
    for j,bg in enumerate(([20,22,26],[220,220,214],checker)):
        comp=np.round(rgb*alpha[...,None]+np.asarray(bg)*(1-alpha[...,None])).astype(np.uint8)
        im=Image.fromarray(comp)
        im.thumbnail((480,375))
        sheet.paste(im,(j*480,k*400+25))
    draw.text((8,k*400+8),f'Decoded native {n}: dark / light / checker',fill='white')
cap.release()
sheet.save(d/'qa'/'decoded-grounds.jpg',quality=95)
receipt={'frameCount':m['frameCount'],'fps':m['fps'],'crop':m['crop'],
    'nativeRgbDifferentChannelValues':different,'brightMagentaPropMaxAlpha':marker_max,
    'faceInteriorMinimumAlpha':face_min,'backgroundRegionsMaxAlpha':background_max,
    'unoccludedShoeRegionMaxAlpha':shoe_max,
    'actorBoundsUnion':[min(v[0] for v in all_bounds),min(v[1] for v in all_bounds),max(v[2] for v in all_bounds),max(v[3] for v in all_bounds)],
    'packedProbe':probe,'decodedSamples':decoded,
    'scope':'Native masking/encoding verified. Source motion and rendered-game visual acceptance are separate.'}
(d/'verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
