#!/usr/bin/env python3
"""Verify the greeting registration (scale 1.5, offset 0,+15) on another take's frame 0."""
import sys,json,numpy as np
from PIL import Image
from measure import grad,phasecorr
W,H=1920,1080
take=Image.open(sys.argv[1]).convert('RGB');ref=grad(Image.open('dealer-f0000.png').convert('RGB'))
wins={'leftRail':(60,500,360,640),'rightRail':(1560,500,1900,640),'shoe':(1340,470,1580,720)}
out={}
for s in (1.495,1.5,1.505):
    w,h=round(1280*s),round(704*s);tg=grad(take.resize((w,h),Image.LANCZOS))
    canvas=np.zeros((H,W));canvas[:min(h,H),:min(w,W)]=tg[:min(h,H),:min(w,W)]
    row={}
    for k,(x0,y0,x1,y1) in wins.items():
        a=np.zeros((H,W));b=np.zeros((H,W));a[y0:y1,x0:x1]=ref[y0:y1,x0:x1];b[y0-40:y1+40,x0-40:x1+40]=canvas[y0-40:y1+40,x0-40:x1+40]
        dx,dy,p=phasecorr(a,b);row[k]=[int(dx),int(dy),round(p,1)]
    out[str(s)]=row
print(sys.argv[1],json.dumps(out))
