from pathlib import Path
from PIL import Image, ImageDraw
import subprocess, json, sys

root = Path(__file__).resolve().parent
name = sys.argv[1] if len(sys.argv) > 1 else 'source'
src = root / (name + '.mp4')
probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-of','json',str(src)]))['streams'][0]
count = int(probe['nb_read_frames'])
rate = probe['avg_frame_rate'].split('/')
fps = float(rate[0]) / float(rate[1])
frames = root / (name + '-review-frames')
frames.mkdir(exist_ok=True)
sheet = Image.new('RGB', (1600, 4 * 330), '#171717')
draw = ImageDraw.Draw(sheet)
samples = []
for j in range(16):
    n = round(j * (count - 1) / 15)
    path = frames / f'{n:04d}.png'
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-vf',f'select=eq(n\\,{n})','-frames:v','1',str(path)],check=True)
    im = Image.open(path)
    w,h = im.size
    im = im.crop((int(w*.35),int(h*.32),int(w*.76),int(h*.78)))
    im.thumbnail((400,300))
    x,y = j%4*400,j//4*330
    sheet.paste(im,(x,y))
    draw.text((x+8,y+305),f'frame {n} / {n/fps:.3f}s',fill='white')
    samples.append({'frame':n,'seconds':n/fps})
sheet.save(root/(name + '-contact-sheet.jpg'),quality=95)
(root/(name + '-probe.json')).write_text(json.dumps({'probe':probe,'samples':samples},indent=2))
