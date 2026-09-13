from pathlib import Path
from PIL import Image,ImageDraw
import subprocess,io
p=Path(__file__).resolve().parent
a=subprocess.check_output(['ffmpeg','-v','error','-i',str(p/'pickup-turn-pace60.mp4'),'-vf','crop=700:330:800:450,scale=350:165','-f','image2pipe','-vcodec','mjpeg','-'])
ims=[Image.open(io.BytesIO(b'\xff\xd8'+b)).copy() for b in a.split(b'\xff\xd8')[1:]]
for page in range(3):
 s=Image.new('RGB',(1750,5*188),'#222');d=ImageDraw.Draw(s)
 for j,im in enumerate(ims[page*25:page*25+25]):
  x=j%5*350;y=j//5*188;s.paste(im,(x,y));n=page*25+j;d.text((x+5,y+168),f'output n{n} {n/60:.3f}s',fill='white')
 s.save(p/f'frames-{page}.jpg',quality=95)
