#!/usr/bin/env python3
"""Scale-independent green key for the approved elevated camera framing."""
import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

D = Path(__file__).resolve().parent


def actor_alpha(rgb, settings, person_matte=None):
    h,w=rgb.shape[:2]
    r,g,b=rgb.astype(np.float32).transpose(2,0,1)
    excess=(g-np.maximum(r,b))/np.maximum(g,24)
    lo,hi=settings['greenExcessOpaque'],settings['greenExcessTransparent']
    green=np.clip((excess-lo)/(hi-lo),0,1)
    green=green*green*(3-2*green)
    alpha=1-green
    yy,xx=np.indices((h,w))
    x0,y0,x1,y1=settings['markerWorkAreaNormalized']
    work=(xx>=x0*w)&(xx<x1*w)&(yy>=y0*h)&(yy<y1*h)
    c=settings['markerColor']
    marker=(r>c['minimumRed'])&(b>c['minimumBlue'])&(r-g>c['minimumRedMinusGreen'])&(b-g>c['minimumBlueMinusGreen'])&(b>g*c['minimumBlueGreenRatio'])&work
    alpha[marker]=0
    if person_matte is not None:
        if person_matte.shape != (h,w):
            raise ValueError('Person matte must use the exact source geometry')
        # Dark green chair edges share colour with black cloth. Local semantic
        # evidence provides the coarse actor silhouette; source chroma still
        # removes every card and supplies the fine hair/finger boundaries.
        semantic=np.clip((person_matte.astype(np.float32)-190)/55,0,1)
        black_cloth=(person_matte>=254)&(r<65)&(g<65)&(b<65)&(excess<.45)
        if settings.get('restoreBlackCloth',True):
            alpha[black_cloth]=1
        alpha*=semantic
        alpha[marker]=0
    binary=(alpha>.55).astype(np.uint8)
    count,labels,stats,_=cv2.connectedComponentsWithStats(binary,8)
    if count<=1:
        raise ValueError('No connected actor in source')
    actor=1+int(np.argmax(stats[1:,cv2.CC_STAT_AREA]))
    keep=(labels==actor).astype(np.uint8)
    support=cv2.dilate(keep,np.ones((3,3),np.uint8)).astype(bool)
    alpha*=support
    edge=cv2.GaussianBlur(keep.astype(np.float32),(3,3),.45)
    alpha=np.round(np.minimum(alpha,edge)*255).astype(np.uint8)
    return alpha


def crop_for_size(width,height,settings):
    # Even pixel bounds keep ordinary 4:2:0 encodes well-defined.
    nx,ny,nw,nh=settings['provisionalCropNormalized']
    x,y=(int(nx*width)//2)*2,(int(ny*height)//2)*2
    right=int(np.ceil((nx+nw)*width/2-1e-8))*2
    bottom=int(np.ceil((ny+nh)*height/2-1e-8))*2
    return [x,y,min(width,right)-x,min(height,bottom)-y]


def inspect_image(source,out,settings,person_path=None):
    out.mkdir(parents=True,exist_ok=True)
    rgb=np.asarray(Image.open(source).convert('RGB'))
    h,w=rgb.shape[:2]
    person=np.asarray(Image.open(person_path).convert('L')) if person_path else None
    alpha=actor_alpha(rgb,settings,person)
    Image.fromarray(alpha).save(out/'alpha.png')
    Image.fromarray(np.dstack([rgb,alpha])).save(out/'rgba.png')
    yy,xx=np.indices(alpha.shape)
    checker=np.where(((xx//32+yy//32)%2)[...,None],[54,59,64],[36,41,46])
    comp=np.round(rgb*(alpha[...,None]/255)+checker*(1-alpha[...,None]/255)).astype(np.uint8)
    Image.fromarray(comp).save(out/'checker.png')
    ys,xs=np.where(alpha>0)
    bounds=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
    x,y,cw,ch=crop_for_size(w,h,settings)
    assert bounds[0]>=x and bounds[1]>=y and bounds[2]<=x+cw and bounds[3]<=y+ch, (bounds,[x,y,cw,ch])
    qa=Image.new('RGB',(1440,720),'#202327')
    for j,bg in enumerate(([20,22,26],[220,220,214],[39,70,57])):
        a=alpha[...,None]/255
        c=np.round(rgb*a+np.array(bg)*(1-a)).astype(np.uint8)
        im=Image.fromarray(c).crop((x,y,x+cw,y+ch))
        im.thumbnail((480,680))
        qa.paste(im,(j*480,20))
    qa.save(out/'grounds.jpg',quality=95)
    receipt={'source':str(source.resolve()),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'dimensions':[w,h],'alphaBounds':bounds,'provisionalCrop':[x,y,cw,ch],
        'sourceToCropRowMajor3x3':[1,0,-x,0,1,-y,0,0,1],
        'cropToSourceRowMajor3x3':[1,0,x,0,1,y,0,0,1],
        'personMatte':str(person_path.resolve()) if person_path else None,
        'nativeRgbAlterations':0,'status':'Single reference frame key only; future video unverified'}
    (out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt,indent=2))


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--image',type=Path,required=True)
    p.add_argument('--out',type=Path,default=D/'start-frame')
    p.add_argument('--person-matte',type=Path)
    a=p.parse_args()
    inspect_image(a.image,a.out,json.loads((D/'settings.json').read_text()),a.person_matte)
