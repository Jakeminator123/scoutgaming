#!/usr/bin/env python3
"""Native-frame actor matte for a green player-box take (any box, any source).

    /tmp/astrid-a9mask-env/bin/python build.py --take-dir <folder with source.mp4 + take-config.json>

Reuses the vetted elevated key (mask-prep/key.py + settings.json) unchanged.
The crop is measured from the actor's alpha union across all frames and
extended to the configured card region, instead of assuming the de1f90a9
crop: box takes reach far to the side and below the old 760px bottom.
Source RGB is never altered before ordinary encoding.
"""
import argparse
import hashlib
import importlib.util
import json
import subprocess
from fractions import Fraction
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
DATE=HERE.parents[1]
REPO=DATE.parents[2]
PREP=DATE/'astrid-elevated-camera/mask-prep'
PREVIOUS_CROP=[560,0,960,760]
MARGIN=8


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def even_down(v):return max(0,(int(v)//2)*2)


def even_up(v,limit):return min(limit,int(np.ceil(v/2))*2)


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--take-dir',type=Path,default=HERE.parent);a=ap.parse_args()
    take=a.take_dir.resolve();config=json.loads((take/'take-config.json').read_text())
    source=take/'source.mp4';D=take/'mask';expected=config['sourceSha256']
    assert sha(source)==expected,'Unexpected video source; no unapproved substitution'
    settings=json.loads((PREP/'settings.json').read_text())
    spec=importlib.util.spec_from_file_location('approved_elevated_key',PREP/'key.py')
    key=importlib.util.module_from_spec(spec);spec.loader.exec_module(key)
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0',
        '-show_entries','stream=width,height,avg_frame_rate,nb_read_frames','-of','json',str(source)]))['streams'][0]
    w,h,rate=probe['width'],probe['height'],probe['avg_frame_rate'];fps=float(Fraction(rate))
    for sub in ('frames','vision','alpha','qa'):(D/sub).mkdir(parents=True,exist_ok=True)
    for old in (D/'frames').glob('[0-9][0-9][0-9][0-9].png'):old.unlink()
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-vsync','0','-start_number','0',str(D/'frames/%04d.png')],check=True)
    paths=sorted((D/'frames').glob('[0-9][0-9][0-9][0-9].png'))
    count=int(probe['nb_read_frames']);assert len(paths)==count
    if not all((D/'vision'/p.name).exists() for p in paths):
        subprocess.run([str(REPO/'pipeline/person-mask'),str(D/'frames'),str(D/'vision')],check=True)
    rows=[];union=[w,h,0,0]
    for path in paths:
        rgb=np.asarray(Image.open(path).convert('RGB'))
        person=np.asarray(Image.open(D/'vision'/path.name).convert('L'))
        alpha=key.actor_alpha(rgb,settings,person)
        Image.fromarray(alpha).save(D/'alpha'/path.name)
        yy,xx=np.where(alpha>0)
        bounds=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)]
        union=[min(union[0],bounds[0]),min(union[1],bounds[1]),max(union[2],bounds[2]),max(union[3],bounds[3])]
        n=int(path.stem)
        rows.append({'frame':n,'seconds':n/fps,'alphaBounds':bounds,'alphaSha256':sha(D/'alpha'/path.name)})
        if n%24==0:print(f'Keyed native {n}/{count} bounds {bounds}',flush=True)
    include=config.get('includeRegion',[union[0],union[1],union[2],union[3]])
    # Keep the previous crop origin when the actor still fits inside it, so the
    # takes share x=560,y=0 with the dealer take; only extend where needed.
    x=min(PREVIOUS_CROP[0],even_down(min(union[0],include[0])-MARGIN))
    y=min(PREVIOUS_CROP[1],even_down(min(union[1],include[1])-MARGIN))
    right=even_up(max(union[2]+MARGIN,include[2]),w);bottom=even_up(max(union[3]+MARGIN,include[3]),h)
    crop=[x,y,right-x,bottom-y]
    assert x<=union[0] and y<=union[1] and right>=union[2] and bottom>=union[3]
    cw,ch=crop[2],crop[3]
    print('actor union bounds',union,'crop',crop,'previous',PREVIOUS_CROP,flush=True)
    thumbs=[];last=count-1
    for path in paths:
        n=int(path.stem)
        rgb=np.asarray(Image.open(path).convert('RGB'));alpha=np.asarray(Image.open(D/'alpha'/path.name).convert('L'))
        if n==last:
            rgba=Image.fromarray(np.dstack([rgb,alpha]));rgba.save(D/f'rest-{last:04d}.png');rgba.crop((x,y,x+cw,y+ch)).save(D/f'rest-{last:04d}-crop.png')
        aa=alpha[y:y+ch,x:x+cw,None]/255
        comp=np.round(rgb[y:y+ch,x:x+cw]*aa+np.array([220,220,214])*(1-aa)).astype(np.uint8)
        im=Image.fromarray(comp);im.thumbnail((320,290));thumbs.append(im)
    for start in range(0,count,20):
        sheet=Image.new('RGB',(1600,1280),'#22262a');draw=ImageDraw.Draw(sheet)
        for j,im in enumerate(thumbs[start:start+20]):
            px,py=j%5*320,j//5*320;sheet.paste(im,(px,py+25));draw.text((px+8,py+8),f'Native {start+j}',fill='white')
        sheet.save(D/'qa'/f'all-native-{start:03d}.jpg',quality=95)
    vf=f'[0:v]crop={cw}:{ch}:{x}:{y},format=yuv420p[rgb];[1:v]crop={cw}:{ch}:{x}:{y},format=yuv420p[a];[rgb][a]vstack=inputs=2[v]'
    subprocess.run(['ffmpeg','-v','error','-y','-framerate',rate,'-start_number','0','-i',str(D/'frames/%04d.png'),
        '-framerate',rate,'-start_number','0','-i',str(D/'alpha/%04d.png'),'-filter_complex',vf,'-map','[v]',
        '-c:v','libx264','-preset','slow','-crf','15','-bf','0','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(D/'actor-packed.mp4')],check=True)
    manifest={'source':str(source),'sourceSha256':expected,'generationId':config.get('generationId'),'jobId':config.get('jobId'),'box':config.get('box'),
        'sourceDimensions':[w,h],'frameCount':count,'fps':rate,'actorUnionBounds':union,'includedCardRegion':include,'crop':crop,'previousTakeCrop':PREVIOUS_CROP,
        'cropPolicy':f'Measured actor alpha union plus {MARGIN}px, extended to the included card region, even-aligned; previous origin kept where it still contains the actor',
        'packedDimensions':[cw,ch*2],'packing':'RGB upper half; straight grayscale alpha lower half',
        'sourceToCropRowMajor3x3':[1,0,-x,0,1,-y,0,0,1],'cropToSourceRowMajor3x3':[1,0,x,0,1,y,0,0,1],
        'packedTopLeftPixelRects':{'rgb':[0,0,cw,ch],'alpha':[0,ch,cw,ch]},
        'actorPackedSha256':sha(D/'actor-packed.mp4'),'restNativeFrame':last,
        'restFullSha256':sha(D/f'rest-{last:04d}.png'),'restCropSha256':sha(D/f'rest-{last:04d}-crop.png'),
        'matteImplementation':str(PREP/'key.py'),'matteImplementationSha256':sha(PREP/'key.py'),
        'settings':settings,'semanticMasks':str(D/'vision'),
        'rgbPolicy':'Fresh native source RGB, no recolouring, retime, interpolation, spatial warp or face repair; ordinary lossy H264 encoding only',
        'frames':rows,'status':'Box candidate matte. Card tracking, take composition and rendered gameplay are separate steps.'}
    (D/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({k:v for k,v in manifest.items() if k not in ('settings','frames')},indent=2))


if __name__=='__main__':main()
