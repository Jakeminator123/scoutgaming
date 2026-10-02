from pathlib import Path
from PIL import Image,ImageDraw
import json,subprocess,sys
root=Path(__file__).resolve().parent
for name in sys.argv[1:]:
 src=root/(name+'.mp4')
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-of','json',str(src)]))['streams'][0]
 count=int(probe['nb_read_frames']);frames=root/(name+'-review-frames');frames.mkdir(exist_ok=True)
 sheet=Image.new('RGB',(1395,4*360));d=ImageDraw.Draw(sheet)
 for j in range(12):
  n=round(j*(count-1)/11);p=frames/f'{n:04}.png'
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-vf',f'select=eq(n\\,{n})','-frames:v','1',str(p)],check=True)
  im=Image.open(p).resize((1920,1080)).crop((570,0,1500,675)).resize((465,338))
  sheet.paste(im,(j%3*465,j//3*360));d.text((j%3*465+8,j//3*360+340),f'frame {n}',fill='white')
 sheet.save(root/(name+'-sheet.jpg'),quality=94)
 print(name,count,probe['width'],probe['height'])
