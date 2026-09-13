from pathlib import Path
import subprocess,numpy as np
from PIL import Image
root=Path(__file__).resolve().parent
sources=[root.parent/'ready-at-table/ready-packed60.mp4',root/'smooth60/deal-centre.mp4',root/'joins/return-34.mp4']
for name,src,end in zip(['ready','centre','idle'],sources,[False,True,True]):
 args=['ffmpeg','-v','error']+(['-sseof','-0.02'] if end else [])+['-i',str(src),'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-']
 b=subprocess.check_output(args);p=np.frombuffer(b,dtype='uint8').reshape((2160,1920,3))
 im=(p[:1080].astype(float)*p[1080:,:,0:1]/255).astype('uint8')
 Image.fromarray(im).save(root/f'{name}-registered.png')
