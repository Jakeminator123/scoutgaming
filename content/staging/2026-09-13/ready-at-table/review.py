"""Inspect the ready-state source before any gameplay installation."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib, json, subprocess
import numpy as np

ROOT = Path(__file__).resolve().parent
source = ROOT / 'source.mp4'
reference = ROOT.parent / 'scene-joins/centre-endpoint.png'
probe = json.loads(subprocess.check_output([
    'ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,nb_read_frames,r_frame_rate:format=duration',
    '-of', 'json', str(source)]))
count = int(probe['streams'][0]['nb_read_frames'])
indices = sorted(set([0, count-1] + [round((count-1)*i/11) for i in range(12)]))
frames = ROOT / 'review-frames'
frames.mkdir(exist_ok=True)
ref = Image.open(reference).convert('RGB')
sheet = Image.new('RGB', (1395, 4*370), '#181818')
draw = ImageDraw.Draw(sheet)
metrics = []
for j, i in enumerate(indices):
    path = frames / f'{i:04}.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(source),
        '-vf', f'select=eq(n\\,{i})', '-frames:v', '1', str(path)], check=True)
    im = Image.open(path).convert('RGB')
    # Remove generator aspect padding with uniform scaling; do not stretch.
    h = im.width * ref.height / ref.width
    y = (im.height-h)/2
    im = im.crop((0, round(y), im.width, round(y+h))).resize(ref.size, Image.Resampling.LANCZOS)
    im.save(frames / f'{i:04}-registered.png')
    thumb = im.resize((465,338), Image.Resampling.LANCZOS)
    x, y = j%3*465, j//3*370
    sheet.paste(thumb, (x,y)); draw.text((x+8,y+343), f'frame {i}', fill='white')
    if i in (0,count-1):
        a,b = np.asarray(ref,dtype=float),np.asarray(im,dtype=float)
        roi = (a.max(axis=2)>25)|(b.max(axis=2)>25)
        metrics.append({'frame':i,'foregroundMeanAbsoluteRGBError':float(np.abs(a-b)[roi].mean())})
sheet.save(ROOT/'motion-sheet.jpg', quality=94)
(ROOT/'review.json').write_text(json.dumps({
    'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
    'probe':probe,'sampledFrames':indices,'endpointDiagnostics':metrics,
    'status':'requires-visual-review',
    'acceptance':['No invented or damaged cards/paper in ready hands','No folded arms',
      'Natural breathing, blink and gaze without speech','Same face, exposure, body scale',
      'Seam-compatible endpoints','Live speech and action handoff before promotion'],
    'limitation':'Endpoint image error is not anatomy, loop or gameplay acceptance.'},indent=2)+'\n')
