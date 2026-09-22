#!/usr/bin/env python3
"""Native-frame matte and RGB/gray-alpha atlas for the elevated take."""
import argparse
from fractions import Fraction
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from key import actor_alpha, crop_for_size

D=Path(__file__).resolve().parent
REPO=D.parents[4]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--source',type=Path,required=True)
    p.add_argument('--out',type=Path,default=D/'video')
    p.add_argument('--crop',help='Explicit source x,y,w,h; otherwise use provisional normalized crop')
    a=p.parse_args()
    source,out=a.source.resolve(),a.out.resolve()
    settings=json.loads((D/'settings.json').read_text())
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0',
        '-show_entries','stream=width,height,avg_frame_rate,nb_read_frames','-of','json',str(source)]))['streams'][0]
    w,h=probe['width'],probe['height']
    rate=probe['avg_frame_rate']
    fps=float(Fraction(rate))
    crop=list(map(int,a.crop.split(','))) if a.crop else crop_for_size(w,h,settings)
    x,y,cw,ch=crop
    assert all(v%2==0 for v in crop) and x>=0 and y>=0 and x+cw<=w and y+ch<=h
    for sub in ('frames','vision','alpha','rgba','qa'):
        (out/sub).mkdir(parents=True,exist_ok=True)
        if sub!='qa':
            for old in (out/sub).glob('[0-9][0-9][0-9][0-9].png'):old.unlink()
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-vsync','0','-start_number','0',
        str(out/'frames'/'%04d.png')],check=True)
    subprocess.run([str(REPO/'pipeline/person-mask'),str(out/'frames'),str(out/'vision')],check=True)
    frames=sorted((out/'frames').glob('*.png'))
    assert len(frames)==int(probe['nb_read_frames'])
    rows=[]
    thumbs=[]
    for path in frames:
        rgb=np.asarray(Image.open(path).convert('RGB'))
        person=np.asarray(Image.open(out/'vision'/path.name).convert('L'))
        alpha=actor_alpha(rgb,settings,person)
        ys,xs=np.where(alpha>0)
        bounds=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
        if not(bounds[0]>=x and bounds[1]>=y and bounds[2]<=x+cw and bounds[3]<=y+ch):
            raise ValueError(f'Crop cuts actor native {path.stem}: {bounds}, crop {crop}')
        Image.fromarray(alpha).save(out/'alpha'/path.name)
        Image.fromarray(np.dstack([rgb,alpha])).save(out/'rgba'/path.name)
        cropped_rgb=rgb[y:y+ch,x:x+cw]
        cropped_a=alpha[y:y+ch,x:x+cw,None]/255
        comp=np.round(cropped_rgb*cropped_a+np.array([220,220,214])*(1-cropped_a)).astype(np.uint8)
        thumb=Image.fromarray(comp)
        thumb.thumbnail((320,290))
        thumbs.append(thumb)
        rows.append({'frame':int(path.stem),'seconds':int(path.stem)/fps,'alphaBounds':bounds,
            'alphaSha256':sha(out/'alpha'/path.name)})
        if int(path.stem)%24==0:print(f'Masked {path.stem}/{len(frames)}',flush=True)
    for start in range(0,len(frames),20):
        sheet=Image.new('RGB',(1600,1280),'#25282b')
        draw=ImageDraw.Draw(sheet)
        for j,thumb in enumerate(thumbs[start:start+20]):
            px,py=j%5*320,j//5*320
            sheet.paste(thumb,(px,py+25))
            draw.text((px+8,py+7),f'Native {start+j}',fill='white')
        sheet.save(out/'qa'/f'all-frames-{start:03d}.jpg',quality=95)
    vf=f'[0:v]crop={cw}:{ch}:{x}:{y},format=yuv420p[rgb];[1:v]crop={cw}:{ch}:{x}:{y},format=yuv420p[a];[rgb][a]vstack=inputs=2[v]'
    subprocess.run(['ffmpeg','-v','error','-y','-framerate',rate,'-start_number','0','-i',str(out/'frames'/'%04d.png'),
        '-framerate',rate,'-start_number','0','-i',str(out/'alpha'/'%04d.png'),'-filter_complex',vf,'-map','[v]',
        '-c:v','libx264','-preset','slow','-crf','15','-bf','0','-pix_fmt','yuv420p','-an','-movflags','+faststart',
        str(out/'actor-packed.mp4')],check=True)
    manifest={'source':str(source),'sourceSha256':sha(source),'sourceDimensions':[w,h],'frameCount':len(frames),
        'fps':rate,'crop':crop,'packedDimensions':[cw,ch*2],
        'packing':'RGB upper half; straight grayscale alpha lower half',
        'sourceToCropRowMajor3x3':[1,0,-x,0,1,-y,0,0,1],
        'cropToSourceRowMajor3x3':[1,0,x,0,1,y,0,0,1],
        'packedTopLeftPixelRects':{'rgb':[0,0,cw,ch],'alpha':[0,ch,cw,ch]},
        'settings':settings,'rgbPolicy':'Original decoded source RGB preserved before ordinary lossy H264 encode',
        'actorPackedSha256':sha(out/'actor-packed.mp4'),'frames':rows,
        'status':'Native matte candidate only; requires complete rendered motion and card registration review'}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({k:v for k,v in manifest.items() if k not in ('frames','settings')},indent=2))


if __name__=='__main__':main()
