#!/usr/bin/env python3
"""Repair interior eye transparency without changing the source RGB or silhouette."""
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent
TAKE = OUT.parent
OLD = TAKE / 'mask'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = json.loads((OLD / 'manifest.json').read_text())
assert sha(TAKE / 'source.mp4') == manifest['sourceSha256']
key_path = TAKE.parent / 'astrid-elevated-camera/mask-prep/key.py'
spec = importlib.util.spec_from_file_location('elevated_key', key_path)
key = importlib.util.module_from_spec(spec)
spec.loader.exec_module(key)
for name in ('alpha', 'qa'):
    (OUT / name).mkdir(exist_ok=True)
x, y, w, h = manifest['crop']
rows, examples = [], []
for frame in sorted((OLD / 'frames').glob('*.png')):
    rgb = np.asarray(Image.open(frame).convert('RGB'))
    person = np.asarray(Image.open(OLD / 'vision' / frame.name).convert('L'))
    before = key.actor_alpha(rgb, manifest['settings'], person)
    binary = np.uint8(before >= 128)
    exterior = 1 - binary
    cv2.floodFill(exterior, None, (0, 0), 2)
    filled = np.uint8(exterior != 2)
    distance = cv2.distanceTransform(filled, cv2.DIST_L2, 5)
    # Only the enclosed, high-confidence head interior. Green iris/teeth
    # reflections are foreground, not holes through the person. Hair edges,
    # neck outline, spaces around the arms and the tabletop retain the key.
    yy = np.indices(before.shape)[0]
    protected = (distance >= 4) & (person >= 250) & (yy < 280)
    after = before.copy()
    after[protected] = 255
    assert np.array_equal(before[~protected], after[~protected])
    assert after[protected].min() == 255
    Image.fromarray(after).save(OUT / 'alpha' / frame.name)
    n = int(frame.stem)
    rows.append({'frame': n, 'protectedPixels': int(protected.sum()),
                 'repairedPixels': int((after != before).sum()),
                 'previousProtectedMinAlpha': int(before[protected].min()),
                 'protectedMinAlpha': 255,
                 'alphaSha256': sha(OUT / 'alpha' / frame.name)})
    if n % 10 == 0 or n == 115:
        bounds = (855, 20, 1070, 275)
        sheet = Image.new('RGB', (645, 280), '#222222')
        draw = ImageDraw.Draw(sheet)
        for col, (label, alpha) in enumerate((('Source', None), ('Old mask', before), ('Repaired mask', after))):
            if alpha is None:
                comp = rgb
            else:
                a = alpha[..., None] / 255
                comp = np.round(rgb * a + np.array([240, 60, 200]) * (1-a)).astype(np.uint8)
            sheet.paste(Image.fromarray(comp).crop(bounds), (col*215, 25))
            draw.text((col*215+5, 5), f'{label} / {n}', fill='white')
        sheet.save(OUT / 'qa' / f'face-{n:03d}.png')
    if n == manifest['frameCount']-1:
        rgba = Image.fromarray(np.dstack([rgb, after]))
        rgba.save(OUT / f'rest-{n:04d}.png')
        rgba.crop((x,y,x+w,y+h)).save(OUT / f'rest-{n:04d}-crop.png')
vf = f'[0:v]crop={w}:{h}:{x}:{y},format=yuv420p[rgb];[1:v]crop={w}:{h}:{x}:{y},format=yuv420p[a];[rgb][a]vstack=inputs=2[v]'
subprocess.run(['ffmpeg','-v','error','-y','-framerate',manifest['fps'],'-start_number','0','-i',str(OLD/'frames/%04d.png'),
                '-framerate',manifest['fps'],'-start_number','0','-i',str(OUT/'alpha/%04d.png'),'-filter_complex',vf,'-map','[v]',
                '-c:v','libx264','-preset','slow','-crf','15','-bf','0','-pix_fmt','yuv420p','-an','-movflags','+faststart',str(OUT/'actor-packed.mp4')],check=True)
manifest['previousPackedSha256'] = manifest['actorPackedSha256']
manifest['actorPackedSha256'] = sha(OUT/'actor-packed.mp4')
manifest['restFullSha256'] = sha(OUT/f"rest-{manifest['restNativeFrame']:04d}.png")
manifest['restCropSha256'] = sha(OUT/f"rest-{manifest['restNativeFrame']:04d}-crop.png")
manifest['faceRepair'] = {'implementation': str(Path(__file__).resolve()), 'implementationSha256': sha(Path(__file__)),
    'policy': 'Opaque enclosed head interior >=4px inside the keyed silhouette, Apple Vision >=250, source y<280. Source RGB and outside alpha unchanged.',
    'frames': rows, 'totalRepairedPixels': sum(row['repairedPixels'] for row in rows)}
for row in manifest['frames']:
    row['alphaSha256'] = rows[row['frame']]['alphaSha256']
manifest['status'] = 'Face alpha repaired after user rejection of transparent eyes; source and registration unchanged. Runtime review required.'
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'frames':len(rows),'repairedPixels':manifest['faceRepair']['totalRepairedPixels'],'packedSha256':manifest['actorPackedSha256']}))
