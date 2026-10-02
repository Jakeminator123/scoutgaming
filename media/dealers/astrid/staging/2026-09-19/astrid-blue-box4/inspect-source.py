"""Extract raw blue-card evidence and contact sheets; never install a take.

Run with /tmp/astrid-a9mask-env/bin/python inspect-source.py.
No card size/pose is inferred by this inspection stage. Source RGB is untouched.
"""
from pathlib import Path
import json, hashlib, math
import cv2
import numpy as np
from PIL import Image, ImageDraw

D = Path(__file__).resolve().parent
OUT = D / 'source-review'
OUT.mkdir(exist_ok=True)
(OUT / 'frames').mkdir(exist_ok=True)
cap = cv2.VideoCapture(str(D / 'source.mp4'))
assert cap.isOpened(), 'source.mp4 not available'
fps = cap.get(cv2.CAP_PROP_FPS)
frames, tiles, overview = [], [], []
bands = {
    'magenta': ([135, 90, 80], [177, 255, 255]),
    'yellow': ([18, 90, 100], [39, 255, 255]),
    'cyan': ([78, 75, 90], [100, 255, 255]),
    'white': ([0, 0, 155], [179, 70, 255]),
}
while True:
    ok, im = cap.read()
    if not ok:
        break
    n = len(frames)
    height, width = im.shape[:2]
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    blue = cv2.inRange(hsv, np.array([101, 90, 60]), np.array([134, 255, 255]))
    blue[:int(height * .35)] = 0
    blue[:, :int(width * .35)] = 0
    blue[:, int(width * .85):] = 0
    count, labels, stats, centres = cv2.connectedComponentsWithStats(blue, 8)
    components = [i for i in range(1, count) if stats[i, cv2.CC_STAT_AREA] >= 20]
    bodies, candidates = [], {name: [] for name in bands}
    region = np.zeros_like(blue)
    for i in components:
        ys, xs = np.where(labels == i)
        points = np.stack([xs, ys], axis=1).astype(np.int32)
        hull = cv2.convexHull(points)
        cv2.fillConvexPoly(region, hull, 255)
        poly = cv2.approxPolyDP(hull, .018 * cv2.arcLength(hull, True), True)
        bodies.append({'centre': centres[i].tolist(), 'pixels': int(stats[i, cv2.CC_STAT_AREA]),
                       'hull': hull[:, 0].tolist(), 'polygon': poly[:, 0].tolist()})
    region = cv2.dilate(region, np.ones((7, 7), np.uint8))
    for name, (lo, hi) in bands.items():
        m = cv2.inRange(hsv, np.array(lo), np.array(hi)) & region
        count_m, _, stats_m, centres_m = cv2.connectedComponentsWithStats(m, 8)
        for i in range(1, count_m):
            area = int(stats_m[i, cv2.CC_STAT_AREA])
            if 3 <= area <= 150:
                candidates[name].append({'centre': centres_m[i].tolist(), 'pixels': area})
    frames.append({'frame': n, 'time': n / fps, 'blueBodies': bodies, 'markerCandidates': candidates})
    cv2.imwrite(str(OUT / 'frames' / f'{n:04}.png'), im)
    # Keep a fixed hand/shoe region so apparent drift is visible in contact sheets.
    x0, y0, x1, y1 = [int(a * b) for a, b in zip((.35, .40, .77, .76), (width, height, width, height))]
    crop = Image.fromarray(cv2.cvtColor(im[y0:y1, x0:x1], cv2.COLOR_BGR2RGB))
    crop.thumbnail((600, 300))
    tile = Image.new('RGB', (600, 330), '#141619')
    tile.paste(crop, (0, 30))
    colours = ','.join(k[0] for k, v in candidates.items() if v)
    ImageDraw.Draw(tile).text((8, 8), f'{n:03} | {n/fps:.3f}s | marker candidates: {colours}', fill='white')
    tiles.append(tile)
    if n % 8 == 0:
        small = Image.fromarray(cv2.cvtColor(im, cv2.COLOR_BGR2RGB))
        small.thumbnail((480, 270))
        o = Image.new('RGB', (480, 296), '#141619')
        o.paste(small, (0, 26))
        ImageDraw.Draw(o).text((8, 7), f'Frame {n} | {n/fps:.3f}s', fill='white')
        overview.append(o)
cap.release()
for start in range(0, len(tiles), 12):
    sheet = Image.new('RGB', (1800, 1320), '#141619')
    for j, tile in enumerate(tiles[start:start+12]):
        sheet.paste(tile, ((j % 3) * 600, (j // 3) * 330))
    sheet.save(OUT / f'contact-{start:03}.jpg', quality=93)
sheet = Image.new('RGB', (1920, math.ceil(len(overview)/4)*296), '#141619')
for j, tile in enumerate(overview):
    sheet.paste(tile, ((j % 4)*480, (j // 4)*296))
sheet.save(OUT / 'overview.jpg', quality=93)
summary = {'sourceSha256': hashlib.sha256((D/'source.mp4').read_bytes()).hexdigest(),
           'width': width, 'height': height, 'fps': fps, 'frameCount': len(frames),
           'blueDetectedFrames': sum(bool(f['blueBodies']) for f in frames),
           'allThreeColouredMarkersFrames': [f['frame'] for f in frames if all(f['markerCandidates'][c] for c in ('magenta','yellow','cyan'))],
           'limits': 'Candidate colours only, not validated correspondence, face state, hand contact, rigid pose, or visual acceptance.'}
(OUT/'evidence.json').write_text(json.dumps({'summary': summary, 'frames': frames}, indent=2)+'\n')
print(json.dumps(summary))
