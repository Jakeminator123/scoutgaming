import sys,pathlib,json,numpy as np
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2
from PIL import Image,ImageDraw
r=pathlib.Path('/Users/solvifyab/Desktop/croupier');o=r/'content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/game-runtime/seven-seat-source-audit/unreviewed';cv2.setNumThreads(1)
def frame(p,n):
 c=cv2.VideoCapture(str(r/p));c.set(cv2.CAP_PROP_POS_FRAMES,n);ok,a=c.read();return a
p='content/staging/2026-09-09/cac-side-delivery/right/source.mp4';a=frame('content/staging/2026-09-09/contact-proof/source.mp4',47);b=frame(p,0);print(a.shape,b.shape)
roi=(760,430,1370,750);x,y,xx,yy=roi;pair=Image.new('RGB',(1220,350),'#202020');d=ImageDraw.Draw(pair)
for j,(im,label) in enumerate([(a,'contact-proof native47'),(b,'uncorrected right native0')]):pair.paste(Image.fromarray(cv2.cvtColor(im[y:yy,x:xx],cv2.COLOR_BGR2RGB)),(j*610,25));d.text((j*610+5,5),label,fill='white')
pair.save(o/'right-prefix-seam.jpg'); mae=float(np.abs(a[y:yy,x:xx].astype(float)-b[y:yy,x:xx]).mean());sheet=Image.new('RGB',(1200,800),'#202020');d=ImageDraw.Draw(sheet)
for j,n in enumerate(range(50,62)):
 im=frame(p,n);im=Image.fromarray(cv2.cvtColor(im[570:850,780:1200],cv2.COLOR_BGR2RGB));im.thumbnail((400,240));x=j%3*400;y=j//3*200;sheet.paste(im,(x,y+20));d.text((x+4,y+3),f'native{n}',fill='white')
sheet.save(o/'right-release50-61.jpg');json.dump({'roi':roi,'native47to0MAE':mae,'sourceTarget':[1058.8333555585189,727.7767702360314],'actualDealerTarget':[(536.5-.13448439316877722)/.5697298989356931,(432.6961669921875-43.76552544495207)/.5697298989356931]},open(o/'right-followup.json','w'),indent=2)
