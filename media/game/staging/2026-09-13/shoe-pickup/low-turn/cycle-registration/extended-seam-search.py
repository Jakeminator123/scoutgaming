from pathlib import Path
import sys,json
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2
p=Path(__file__).resolve().parent;b=p.parent;trans=json.loads((p/'clip-transforms.json').read_text())['clips'];im={}
for clip,ns in [('source',range(54,97)),('slide',range(16))]:
 for n in ns:
  a=cv2.imread(str(b/'mattes'/clip/'frames'/f'{n+1:04d}.png'));M=np.array(trans[clip]['matrix']);im[clip,n]=cv2.warpAffine(a,M,(1920,1080))
# Appearance error in fixed hand ROI; no alignment of hand itself.
roi=(925,545,1110,654);x0,y0,x1,y1=roi;scores=[]
for n in range(54,97):
 for m in range(16):
  a=im['source',n][y0:y1,x0:x1];c=im['slide',m][y0:y1,x0:x1];ag=cv2.cvtColor(a,cv2.COLOR_BGR2GRAY);cg=cv2.cvtColor(c,cv2.COLOR_BGR2GRAY);err=float(np.mean(np.abs(ag.astype(float)-cg)));edgesa=cv2.Canny(ag,45,100)>0;edgesb=cv2.Canny(cg,45,100)>0;dist=cv2.distanceTransform((~edgesb).astype(np.uint8),cv2.DIST_L2,3);ch=float(dist[edgesa].mean());scores.append({'pickupFrame':n,'slideFrame':m,'grayMAE':err,'sourceToSlideEdgeChamferPixels':ch})
scores.sort(key=lambda x:x['grayMAE']);(p/'extended-seam-candidates.json').write_text(json.dumps({'status':'fixed-camera hand appearance ranking only, not physical contact measurement','roi':roi,'ranked':scores},indent=2)+'\n')
sheet=Image.new('RGB',(1400,15*240),'#222')
choices=[('source',n) for n in range(54,97)]+[('slide',n) for n in range(16)]
for j,(clip,n) in enumerate(choices):
 crop=cv2.cvtColor(im[clip,n][530:680,900:1180],cv2.COLOR_BGR2RGB);tile=Image.fromarray(crop).resize((350,188));sheet.paste(tile,(j%4*350,j//4*240));ImageDraw.Draw(sheet).text((j%4*350+5,j//4*240+195),f'{clip} n{n}; common camera',fill='white')
sheet.save(p/'extended-seam-all.jpg',quality=95)
print(scores[:10])
