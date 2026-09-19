#!/usr/bin/env python3
import hashlib
import json
import subprocess
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw

D=Path(__file__).resolve().parent
m=json.loads((D/'manifest.json').read_text())
assert hashlib.sha256((D/'actor-packed.mp4').read_bytes()).hexdigest()==m['actorPackedSha256']
assert m['sourceSha256']=='dfaeea2b4dae3cad918a2a3af9114d261131939ea636cf2e3427172b3b33402b'
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0',
    '-show_entries','stream=width,height,avg_frame_rate,nb_read_frames,has_b_frames','-of','json',str(D/'actor-packed.mp4')]))['streams'][0]
assert [probe['width'],probe['height']]==[960,1520]
assert probe['avg_frame_rate']=='24/1' and int(probe['nb_read_frames'])==97 and probe['has_b_frames']==0
rest=np.asarray(Image.open(D/'rest-0096.png').convert('RGBA'))
native=np.asarray(Image.open(D/'frames/0096.png').convert('RGB'))
assert np.array_equal(rest[...,:3],native)
assert np.array_equal(rest[...,3],np.asarray(Image.open(D/'alpha/0096.png')))
assert np.array_equal(np.asarray(Image.open(D/'rest-0096-crop.png')),rest[:760,560:1520])
assert rest.shape==[1080,1920,4] or rest.shape==(1080,1920,4)
face_min=255;prop_max=0;background_max=0
for row in m['frames']:
    n=row['frame'];a=np.asarray(Image.open(D/'alpha'/f'{n:04d}.png').convert('L'))
    rgb=np.asarray(Image.open(D/'frames'/f'{n:04d}.png').convert('RGB'))
    r,g,b=rgb.astype(float).transpose(2,0,1)
    yy=np.indices(a.shape)[0]
    marker=(r>125)&(b>75)&(r-g>30)&(b-g>8)&(b>g*1.15)&(yy>.28*1080)
    prop_max=max(prop_max,int(a[marker].max(initial=0)))
    face_min=min(face_min,int(a[105:205,927:1000].min()))
    background_max=max(background_max,int(a[:,:550].max()),int(a[760:,:].max()),int(a[550:650,1360:1480].max()))
assert face_min==255 and prop_max==0 and background_max==0
cap=cv2.VideoCapture(str(D/'actor-packed.mp4'))
sheet=Image.new('RGB',(1440,1600),'#22262a');draw=ImageDraw.Draw(sheet)
samples=[]
for j,n in enumerate([0,16,36,96]):
    cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,bgr=cap.read();assert ok
    packed=cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB);rgb=packed[:760];alpha=packed[760:,:,0].astype(float)/255
    src=np.asarray(Image.open(D/'frames'/f'{n:04d}.png').convert('RGB'))[:760,560:1520]
    aa=np.asarray(Image.open(D/'alpha'/f'{n:04d}.png').convert('L'))[:760,560:1520]/255
    face=(slice(105,205),slice(367,440))
    samples.append({'frame':n,'faceEncodedRgbMae':float(abs(rgb[face].astype(float)-src[face]).mean()),'alphaMeanAbsoluteError':float(abs(alpha-aa).mean())})
    yy,xx=np.indices(alpha.shape);checker=np.where(((xx//24+yy//24)%2)[...,None],[54,59,64],[36,41,46])
    for col,bg in enumerate(([20,22,26],[220,220,214],checker)):
        comp=np.round(rgb*alpha[...,None]+np.asarray(bg)*(1-alpha[...,None])).astype(np.uint8)
        im=Image.fromarray(comp);im.thumbnail((480,375));sheet.paste(im,(480*col,j*400+25))
    draw.text((8,j*400+8),f'Decoded {n}: dark / light / transparent checker',fill='white')
cap.release();sheet.save(D/'qa/decoded-grounds.jpg',quality=95)
receipt={'packedProbe':probe,'allFramesFaceInteriorMinAlpha':face_min,'allFramesMagentaMarkerMaxAlpha':prop_max,
    'allFramesBackgroundAndUnoccludedShoeMaxAlpha':background_max,'restRgbDifferentValues':0,
    'restFullMatchesNative96':True,'restCropMatchesFull':True,'alphaChangedFromPriorVerifiedElevatedMatte':m['previousAlphaDifferentPixels'],
    'decodedSamples':samples,'scope':'Mask/media contract; does not verify Blender camera or rendered gameplay.'}
(D/'verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
