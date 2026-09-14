from pathlib import Path
import subprocess
from PIL import Image,ImageDraw
b=Path('/Users/solvifyab/Desktop/croupier/content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer');o=b/'card-review';tmp=Path('/tmp/transfer-card-frames');tmp.mkdir(exist_ok=True)
subprocess.run(['ffmpeg','-v','error','-i',str(b/'source.mp4'),'-start_number','0','-y',str(tmp/'%04d.png')],check=True)
for start in [0,30,60,90]:
 sheet=Image.new('RGB',(1800,1300))
 for i,n in enumerate(range(start,min(start+30,121))):
  im=Image.open(tmp/f'{n:04d}.png').crop((880,490,1580,920)).resize((360,215));x=i%5*360;y=i//5*216;sheet.paste(im,(x,y));d=ImageDraw.Draw(sheet);d.rectangle((x,y,x+95,y+19),fill='black');d.text((x+2,y+2),f'n{n} {n/24:.3f}s',fill='yellow')
 sheet.save(o/f'native-{start:03d}.jpg',quality=95)
