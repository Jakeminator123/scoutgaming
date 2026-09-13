from pathlib import Path
from PIL import Image,ImageDraw
import subprocess,io
out=Path(__file__).resolve().parent
for name in ['extract-turn','slide-return']:
 data=subprocess.check_output(['ffmpeg','-v','error','-i',str(out.parent/(name+'.mp4')),'-vf','scale=960:540,crop=480:260:310:180','-f','image2pipe','-vcodec','mjpeg','-'])
 parts=data.split(b'\xff\xd8')[1:]
 frames=[Image.open(io.BytesIO(b'\xff\xd8'+p)).copy() for p in parts]
 for page in range(3):
  sheet=Image.new('RGB',(1600,5*202),'#202020');d=ImageDraw.Draw(sheet)
  for j,im in enumerate(frames[page*25:page*25+25]):
   im.thumbnail((320,176));x=j%5*320;y=j//5*202;sheet.paste(im,(x,y));d.text((x+6,y+178),f'{name} n={page*25+j} t={(page*25+j)/24:.3f}',fill='white')
  sheet.save(out/f'{name}-{page}.jpg',quality=92)
