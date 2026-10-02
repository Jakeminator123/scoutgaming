from pathlib import Path
from PIL import Image
import numpy as np,cv2
root=Path(__file__).resolve().parent
p=np.asarray(Image.open(root.parent/'scene-joins/pose-47-packed.png').convert('RGB'))
rgb=p[:1080].copy();m=p[1080:,:,0].copy()
k=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(11,11))
core=(m>200).astype('uint8')*255
opened=cv2.morphologyEx(core,cv2.MORPH_OPEN,k)
opened=cv2.erode(opened,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
opened=cv2.GaussianBlur(opened,(5,5),.8)
# Only upper body: retain the original hand and contact matte unchanged.
w=np.clip((460-np.arange(1080))/40,0,1)[:,None]
clean=np.minimum(m,opened)
clean=(m*(1-w)+clean*w).astype('uint8')
for name,mask in [('before',m),('after',clean)]:
 out=(rgb.astype(float)*mask[:,:,None]/255).astype('uint8')
 Image.fromarray(out).crop((570,0,1500,675)).save(root/f'{name}.png')
Image.fromarray(clean).save(root/'mask.png')
