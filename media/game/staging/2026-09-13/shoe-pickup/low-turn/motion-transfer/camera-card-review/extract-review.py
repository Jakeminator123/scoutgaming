from pathlib import Path
import subprocess,hashlib,json
from PIL import Image,ImageDraw
b=Path('/Users/solvifyab/Desktop/croupier/content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer');o=b/'camera-card-review';tmp=Path('/tmp/camera-card-frames');tmp.mkdir(exist_ok=True)
subprocess.run(['ffmpeg','-v','error','-i',str(b/'camera-locked.mp4'),'-q:v','2','-start_number','0','-y',str(tmp/'%04d.jpg')],check=True)
for start in [0,30,60,90]:
 sheet=Image.new('RGB',(2000,1500))
 for i,n in enumerate(range(start,min(start+30,121))):
  im=Image.open(tmp/f'{n:04d}.jpg').crop((740,470,1390,900)).resize((400,248));x=i%5*400;y=i//5*250;sheet.paste(im,(x,y));d=ImageDraw.Draw(sheet);d.rectangle((x,y,x+105,y+19),fill='black');d.text((x+2,y+2),f'n{n} {n/24:.3f}s',fill='yellow')
 sheet.save(o/f'native-{start:03d}.jpg',quality=95)
print(hashlib.sha256((b/'camera-locked.mp4').read_bytes()).hexdigest())
