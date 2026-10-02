import json,numpy as np
from PIL import Image
from measure import grad,phasecorr
W,H=1920,1080
take=Image.open('take-f0000.png').convert('RGB')
wins={'leftRail':(60,500,360,640),'rightRail':(1560,500,1900,640),'shoe':(1340,470,1580,720),'frontRail':(700,940,1250,1080)}
def shifts(s,refname):
    ref=grad(Image.open(refname).convert('RGB'))
    w,h=round(1280*s),round(704*s);tg=grad(take.resize((w,h),Image.LANCZOS))
    canvas=np.zeros((H,W));canvas[:min(h,H),:min(w,W)]=tg[:min(h,H),:min(w,W)]
    out={}
    for k,(x0,y0,x1,y1) in wins.items():
        a=np.zeros((H,W));b=np.zeros((H,W));a[y0:y1,x0:x1]=ref[y0:y1,x0:x1];b[y0-40:y1+40,x0-40:x1+40]=canvas[y0-40:y1+40,x0-40:x1+40]
        out[k]=phasecorr(a,b)
    return out
res={}
for refname in ('idle-f0000.png','dealer-f0000.png'):
    for s in (1.49,1.495,1.5,1.505,1.51):
        sh=shifts(s,refname);res[f'{refname}@{s}']={k:[int(v[0]),int(v[1]),round(v[2],1)] for k,v in sh.items()}
        print(refname,s,res[f'{refname}@{s}'])
json.dump(res,open('refine.json','w'),indent=1)
