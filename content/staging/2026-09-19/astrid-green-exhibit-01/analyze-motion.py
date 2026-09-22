"""Inspect generated green-card footage; measurements are not visual acceptance."""
from pathlib import Path
import sys
import cv2
import json
import numpy as np
from PIL import Image, ImageDraw

root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent
cap = cv2.VideoCapture(str(root / 'source.mp4'))
fps = cap.get(cv2.CAP_PROP_FPS)
assert fps > 0, 'Unreadable source'
frames, report = [], []
while True:
    ok, bgr = cap.read()
    if not ok:
        break
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    marker = cv2.inRange(hsv, np.array([135, 100, 80]), np.array([179, 255, 255]))
    count, _, stats, centres = cv2.connectedComponentsWithStats(marker)
    dots = [{'xy': [round(float(x), 2) for x in centres[i]], 'area': int(stats[i, 4])}
            for i in range(1, count) if 3 <= stats[i, 4] <= 200]
    lime = cv2.inRange(hsv, np.array([28, 120, 130]), np.array([48, 255, 255]))
    count, _, stats, centres = cv2.connectedComponentsWithStats(lime)
    cards = [{'xy': [round(float(x), 2) for x in centres[i]],
              'bbox': [int(x) for x in stats[i, :4]], 'area': int(stats[i, 4])}
             for i in range(1, count) if stats[i, 4] >= 30]
    report.append({'frame': len(frames), 'seconds': round(len(frames)/fps, 4),
                   'magentaComponents': dots, 'limeComponents': cards})
    frames.append(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
cap.release()
assert frames
(root / 'tracking-observations.json').write_text(json.dumps({
    'note': 'Colour components only. Occlusion and edge-on views can hide markers; not a solved card track.',
    'fps': fps, 'width': frames[0].shape[1], 'height': frames[0].shape[0],
    'frames': report}, indent=2) + '\n')
indices = sorted(set(min(len(frames)-1, round(t*fps)) for t in
                     [0, .167, .333, .5, .667, .833, 1, 1.167, 1.333, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4]))
sheet = Image.new('RGB', (4*480, ((len(indices)+3)//4)*292), '#15181b')
draw = ImageDraw.Draw(sheet)
for n, i in enumerate(indices):
    im = Image.fromarray(frames[i]); im.thumbnail((480, 270))
    x, y = n%4*480, n//4*292
    sheet.paste(im, (x, y)); draw.text((x+8, y+273), f'{i:02d} / {i/fps:.3f}s', fill='white')
sheet.save(root / 'motion-sheet.jpg', quality=94)
# Native samples for close inspection, no image enhancement or alteration.
out = root / 'frames'; out.mkdir(exist_ok=True)
for i in indices:
    Image.fromarray(frames[i]).save(out / f'{i:03d}.png')
print(json.dumps({'frames': len(frames), 'fps': fps, 'sampleFrames': indices,
                  'framesWithFourColourComponents': sum(len(x['magentaComponents']) == 4 for x in report)}))
