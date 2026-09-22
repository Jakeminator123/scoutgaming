#!/usr/bin/env python3
"""Rigid uniform scale + translation of the 1280x704 ElevenLabs take onto the
1920x1080 plate registration shared by the Seedance takes. Phase correlation of
gradient images with the actor region masked out; scale searched on a grid."""
import json,numpy as np
from PIL import Image
def grad(a):
    g=np.asarray(a.convert('L'),dtype=np.float64)
    gx=np.zeros_like(g);gy=np.zeros_like(g);gx[:,1:-1]=g[:,2:]-g[:,:-2];gy[1:-1]=g[2:]-g[:-2]
    return np.hypot(gx,gy)
def phasecorr(a,b):
    A=np.fft.fft2(a);B=np.fft.fft2(b);R=A*np.conj(B);R/=np.abs(R)+1e-9
    r=np.real(np.fft.ifft2(R));i=np.unravel_index(np.argmax(r),r.shape)
    dy,dx=i;h,w=r.shape
    if dy>h/2:dy-=h
    if dx>w/2:dx-=w
    return dx,dy,float(r.max()/ (r.std()+1e-12))
W,H=1920,1080
take=Image.open('take-f0000.png').convert('RGB')
results={}
for refname in ('idle-f0000.png','dealer-f0000.png'):
    ref=Image.open(refname).convert('RGB');rg=grad(ref)
    # actor exclusion in reference coordinates (head to hands), static props kept
    mask=np.ones((H,W));mask[0:760,640:1330]=0
    rg*=mask
    best=None
    for s in np.arange(1.45,1.56,0.005):
        w,h=round(1280*s),round(704*s)
        tg=grad(take.resize((w,h),Image.LANCZOS))
        canvas=np.zeros((H,W));cy,cx=min(h,H),min(w,W);canvas[:cy,:cx]=tg[:cy,:cx]
        canvas*=mask
        dx,dy,peak=phasecorr(rg,canvas)
        if best is None or peak>best[3]:best=(float(s),int(dx),int(dy),peak)
    results[refname]={'scale':best[0],'dx':best[1],'dy':best[2],'peak':round(best[3],2)}
    print(refname,results[refname])
json.dump(results,open('coarse.json','w'),indent=1)
