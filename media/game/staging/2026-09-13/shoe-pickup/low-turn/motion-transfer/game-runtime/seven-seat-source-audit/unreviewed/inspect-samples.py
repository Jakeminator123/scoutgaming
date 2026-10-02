import sys,json,pathlib
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2
from PIL import Image,ImageDraw
cv2.setNumThreads(1)
r=pathlib.Path('/Users/solvifyab/Desktop/croupier'); o=r/'content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/game-runtime/seven-seat-source-audit/unreviewed'
paths=['cac-side-delivery/right','centre-continuity','dealer-front-continuation','dealer-delivery']; out=[]
for name in paths:
 p=r/'content/staging/2026-09-09'/name/'source.mp4'; c=cv2.VideoCapture(str(p)); n=int(c.get(7)); fps=c.get(5); inds=sorted(set([0]+[round((n-1)*i/11) for i in range(1,12)])); sheet=Image.new('RGB',(1200,4*250),'#202020');d=ImageDraw.Draw(sheet)
 for j,k in enumerate(inds):
  c.set(0 if False else cv2.CAP_PROP_POS_FRAMES,k);ok,a=c.read()
  if not ok:continue
  h,w=a.shape[:2];im=Image.fromarray(cv2.cvtColor(a,cv2.COLOR_BGR2RGB));im=im.crop((int(w*.22),int(h*.4),int(w*.89),int(h*.9)));im.thumbnail((400,220));x=(j%3)*400;y=(j//3)*250;sheet.paste(im,(x,y+25));d.text((x+5,y+5),f'{name} native {k}',fill='white')
 sheet.save(o/(name.replace('/','-')+'.jpg'));out.append({'path':str(p),'nativeFrames':n,'fps':fps,'inspectedSamples':inds,'size':[w,h]})
json.dump(out,open(o/'samples.json','w'),indent=2)
