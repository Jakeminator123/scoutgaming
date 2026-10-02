from pathlib import Path
from PIL import Image,ImageDraw
import subprocess,io,json
p=Path(__file__).resolve().parent
sets={'overview':[round(j*239/23) for j in range(24)],'seams':[58,59,60,61,62,63,64,65,114,115,116,117,118,119,120,121,175,176,177,178,179,180,181,182]}
for name,frames in sets.items():
 filt='+'.join(f'eq(n\\,{n})' for n in frames)
 data=subprocess.check_output(['ffmpeg','-v','error','-i',str(p/'cycle-pace60.mp4'),'-vf',f'select={filt},crop=880:620:650:330,scale=400:-1','-fps_mode','vfr','-f','image2pipe','-vcodec','mjpeg','-'])
 s=Image.new('RGB',(1600,6*315),'#222');d=ImageDraw.Draw(s)
 for j,b in enumerate(data.split(b'\xff\xd8')[1:]):
  im=Image.open(io.BytesIO(b'\xff\xd8'+b));x=j%4*400;y=j//4*315;s.paste(im,(x,y));d.text((x+5,y+288),f'output n{frames[j]} / {frames[j]/60:.3f}s',fill='white')
 s.save(p/(name+'.jpg'),quality=94)
