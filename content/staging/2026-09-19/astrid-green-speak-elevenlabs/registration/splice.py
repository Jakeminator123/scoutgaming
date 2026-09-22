import json,numpy as np
from PIL import Image
from measure import phasecorr
def L(p):return np.asarray(Image.open(p).convert('L'),dtype=np.float64)
base=L('idle-f0000.png');dealer=L('dealer-f0000.png')
wins={'head':(870,26,1050,226),'torso':(760,240,1200,520),'leftHand':(760,560,960,700),'shoeHand':(1080,540,1330,700)}
out={}
for name,p in (('source-f0000','source-f0000.png'),('source-f0115','source-f0115.png')):
    s=L(p);out[name]={}
    for ref,r in (('baseIdle',base),('dealerTake',dealer)):
        row={}
        for k,(x0,y0,x1,y1) in wins.items():
            a=r[y0:y1,x0:x1];b=s[y0:y1,x0:x1]
            dx,dy,peak=phasecorr(a-a.mean(),b-b.mean());row[k]={'dx':int(dx),'dy':int(dy),'meanAbsDiff':round(float(np.abs(a-b).mean()),2)}
        out[name][ref]=row
print(json.dumps(out,indent=1));json.dump(out,open('splice.json','w'),indent=1)
a=L('source-f0000.png');b=L('source-f0115.png');print('take first vs last frame mean abs diff full/head',round(float(np.abs(a-b).mean()),2),round(float(np.abs(a[26:226,870:1050]-b[26:226,870:1050]).mean()),2))
