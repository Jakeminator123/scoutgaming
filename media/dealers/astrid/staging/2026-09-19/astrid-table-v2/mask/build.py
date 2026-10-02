#!/usr/bin/env python3
"""Rebuild the unwarped elevated Astrid mask for the Blender PlateCam table."""
import hashlib
import importlib.util
import json
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

D=Path(__file__).resolve().parent
DATE=D.parents[1]
SOURCE=DATE/'astrid-elevated-camera/source.mp4'
PREP=DATE/'astrid-elevated-camera/mask-prep'
CACHE=PREP/'video'
EXPECTED='dfaeea2b4dae3cad918a2a3af9114d261131939ea636cf2e3427172b3b33402b'
CROP=[560,0,960,760]


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    assert sha(SOURCE)==EXPECTED,'Unexpected video source; no unapproved substitution'
    settings=json.loads((PREP/'settings.json').read_text())
    spec=importlib.util.spec_from_file_location('approved_elevated_key',PREP/'key.py')
    key=importlib.util.module_from_spec(spec);spec.loader.exec_module(key)
    for sub in ('frames','alpha','qa'):(D/sub).mkdir(exist_ok=True)
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(SOURCE),'-vsync','0','-start_number','0',str(D/'frames/%04d.png')],check=True)
    paths=sorted((D/'frames').glob('[0-9][0-9][0-9][0-9].png'))
    assert len(paths)==97
    rows=[];thumbs=[];changed=0
    x,y,cw,ch=CROP
    for path in paths:
        rgb=np.asarray(Image.open(path).convert('RGB'))
        # Cached local semantic mask is reused only after exact native RGB
        # identity is checked against a fresh decode of the authorized source.
        cached=np.asarray(Image.open(CACHE/'frames'/path.name).convert('RGB'))
        assert np.array_equal(rgb,cached),f'Cached native mismatch {path.name}'
        person=np.asarray(Image.open(CACHE/'vision'/path.name).convert('L'))
        alpha=key.actor_alpha(rgb,settings,person)
        previous=np.asarray(Image.open(CACHE/'alpha'/path.name).convert('L'))
        changed+=int(np.count_nonzero(alpha!=previous))
        yy,xx=np.where(alpha>0)
        bounds=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)]
        assert bounds[0]>=x and bounds[1]>=y and bounds[2]<=x+cw and bounds[3]<=y+ch
        Image.fromarray(alpha).save(D/'alpha'/path.name)
        n=int(path.stem)
        if n==96:
            rgba=Image.fromarray(np.dstack([rgb,alpha]))
            rgba.save(D/'rest-0096.png')
            rgba.crop((x,y,x+cw,y+ch)).save(D/'rest-0096-crop.png')
        aa=alpha[y:y+ch,x:x+cw,None]/255
        comp=np.round(rgb[y:y+ch,x:x+cw]*aa+np.array([220,220,214])*(1-aa)).astype(np.uint8)
        im=Image.fromarray(comp);im.thumbnail((320,290));thumbs.append(im)
        rows.append({'frame':n,'seconds':n/24,'alphaBounds':bounds,'alphaSha256':sha(D/'alpha'/path.name)})
        if n%24==0:print(f'Checked and keyed native {n}/97',flush=True)
    for start in range(0,97,20):
        sheet=Image.new('RGB',(1600,1280),'#22262a');draw=ImageDraw.Draw(sheet)
        for j,im in enumerate(thumbs[start:start+20]):
            px,py=j%5*320,j//5*320;sheet.paste(im,(px,py+25));draw.text((px+8,py+8),f'Native {start+j}',fill='white')
        sheet.save(D/'qa'/f'all-native-{start:03d}.jpg',quality=95)
    vf='[0:v]crop=960:760:560:0,format=yuv420p[rgb];[1:v]crop=960:760:560:0,format=yuv420p[a];[rgb][a]vstack=inputs=2[v]'
    subprocess.run(['ffmpeg','-v','error','-y','-framerate','24','-start_number','0','-i',str(D/'frames/%04d.png'),
        '-framerate','24','-start_number','0','-i',str(D/'alpha/%04d.png'),'-filter_complex',vf,'-map','[v]',
        '-c:v','libx264','-preset','slow','-crf','15','-bf','0','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(D/'actor-packed.mp4')],check=True)
    manifest={'source':str(SOURCE),'sourceSha256':EXPECTED,'generationId':'de1f90a9','sourceDimensions':[1920,1080],
        'frameCount':97,'fps':'24/1','crop':CROP,'packedDimensions':[960,1520],
        'packing':'RGB upper half; straight grayscale alpha lower half',
        'sourceToCropRowMajor3x3':[1,0,-560,0,1,0,0,0,1],'cropToSourceRowMajor3x3':[1,0,560,0,1,0,0,0,1],
        'packedTopLeftPixelRects':{'rgb':[0,0,960,760],'alpha':[0,760,960,760]},
        'actorPackedSha256':sha(D/'actor-packed.mp4'),'restNativeFrame':96,
        'restFullSourceDimensions':[1920,1080],'restCroppedDimensions':[960,760],
        'restFullSha256':sha(D/'rest-0096.png'),'restCropSha256':sha(D/'rest-0096-crop.png'),
        'previousAlphaDifferentPixels':changed,'matteImplementation':str(PREP/'key.py'),'matteImplementationSha256':sha(PREP/'key.py'),
        'settings':settings,'semanticCache':str(CACHE/'vision'),'cacheValidation':'All 97 native RGB images exactly match fresh source decode',
        'rgbPolicy':'Fresh native source RGB, no recolouring, spatial warp, perspective transform or frame resampling; ordinary lossy H264 encoding only',
        'frames':rows,'status':'Blender-table candidate. Geometry and full rendered gameplay acceptance belong to root integration.'}
    (D/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({k:v for k,v in manifest.items() if k not in ('settings','frames')},indent=2))


if __name__=='__main__':main()
