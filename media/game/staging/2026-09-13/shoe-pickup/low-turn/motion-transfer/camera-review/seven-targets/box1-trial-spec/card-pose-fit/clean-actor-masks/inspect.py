import sys,pathlib
sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np
from PIL import Image,ImageDraw
cv2.setNumThreads(1)
b=pathlib.Path('/Users/solvifyab/Desktop/croupier/content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/camera-review/seven-targets/box1-trial-spec'); o=b/'card-pose-fit/clean-actor-masks'; cap=cv2.VideoCapture(str(b/'source.mp4')); keys=[0,18,30,48,63,80,96]; out=Image.new('RGB',(1280,len(keys)*360))
for i,n in enumerate(keys):
 cap.set(0 if False else cv2.CAP_PROP_POS_FRAMES,n);ok,a=cap.read();a=cv2.cvtColor(a,cv2.COLOR_BGR2RGB);m=np.array(Image.open(b/f'card-pose-fit/person-masks/{n:04d}.png')); rgb=a.astype(float)*m[:,:,None]/255+np.array([55,80,90])*(1-m[:,:,None]/255);out.paste(Image.fromarray(a).resize((640,360)),(0,i*360));out.paste(Image.fromarray(rgb.astype('uint8')).resize((640,360)),(640,i*360));ImageDraw.Draw(out).text((4,i*360+4),str(n),fill='red')
out.save(o/'raw-review.jpg')
