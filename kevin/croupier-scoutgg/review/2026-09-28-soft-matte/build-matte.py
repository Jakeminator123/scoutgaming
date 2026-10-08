"""Soft hand matte for the dealer-card area (alternative to the polygon tracks).

Locked camera: every deal clip starts on the same still, so its first frame is a
clean plate. Hand = pixels that differ from the plate AND are skin toned (the
white prop and the dark card back are not). Both tests are soft ramps, so the
result is a real alpha with feathered, motion-blurred finger edges.

Output per clip: public/media/deal/matte/<track>.png, a grid sprite of grey
frames (white = cards visible, black = finger in front), used as an SVG mask.
Run with Python + OpenCV + numpy.
"""
import cv2, numpy as np, json, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
import os
# MATTE_OUT builds into another folder so a running game keeps its mattes.
OUT = Path(os.environ.get('MATTE_OUT', ROOT / 'public/media/deal/matte'))
REVIEW = Path(__file__).resolve().parent
OUT.mkdir(parents=True, exist_ok=True)
manifest = json.loads((ROOT / 'public/media/manifest.json').read_text())

# Same dealer-fan area as the polygon tracks (326..575 x 850..940) plus margin.
# Whole card area: her own cards and every player seat (1..7), incl. fans and splits.
X, Y, W, H = 30, 836, 1020, 344
COLS = 10
# Stored at half resolution per frame (a soft edge loses nothing); keeps sprites small.
CW, CH = W // 2, H // 2

def ramp(v, lo, hi):
    return np.clip((v - lo) / (hi - lo), 0, 1)

index, samples = {}, []
for clip in manifest['deal']:
    track = clip['id'].replace('deal_pos', '').replace('deal_', '')
    cap = cv2.VideoCapture(str(ROOT / ('public' + clip['url'])))
    frames = []
    while True:
        ok, bgr = cap.read()
        if not ok: break
        frames.append(cv2.GaussianBlur(bgr[Y:Y + H, X:X + W], (3, 3), 0).astype(np.float32))
    cap.release()
    plate = frames[0]
    mattes = []
    for f in frames:
        b, g, r = f[..., 0], f[..., 1], f[..., 2]
        diff = np.abs(f - plate).max(axis=2)
        # Skin: warm (r clearly above b), not near-white paper, not the dark back.
        # Cream table lettering is warm too, but red and green are close (r - g ~ 10);
        # skin is clearly redder than green (r - g ~ 45).
        warm = ramp(r - b, 10, 28) * ramp(r, 95, 130) * ramp(r - g, 18, 32)
        # Only truly neutral white is the prop; pinkish nails (r - b > 12) stay hand.
        paper = ramp(np.minimum(np.minimum(r, g), b), 150, 190) * (1 - ramp(r - b, 6, 14))
        a = ramp(diff, 14, 34) * warm * (1 - paper)
        # Keep only regions connected to a region edge (the arm enters from outside).
        hard = (a > 0.2).astype(np.uint8)
        n, lab, stats, _ = cv2.connectedComponentsWithStats(hard, 8)
        keep = np.zeros_like(hard)
        for i in range(1, n):
            x, y, w, h, area = stats[i]
            if area >= 40 and (y == 0 or x == 0 or x + w == W or y + h == H):
                keep[lab == i] = 1
        # A hand is solid: bridge pale nails and motion-blur gaps to the fingers,
        # then fill every enclosed hole, so no card shows THROUGH her hand.
        keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
        cs, _ = cv2.findContours(keep, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        solid = np.zeros_like(keep); cv2.drawContours(solid, cs, -1, 1, -1)
        # Softness only on the outer edge: solid core, soft ramp from the colour test outside it.
        zone = cv2.dilate(solid, np.ones((5, 5), np.uint8)).astype(np.float32)
        # Grow 1 px before feathering, so the half-transparent step lands on the
        # finger's true outline instead of inside the fingertip.
        grown = cv2.dilate(solid, np.ones((3, 3), np.uint8)).astype(np.float32)
        a = np.maximum(a * zone, cv2.GaussianBlur(grown, (0, 0), 0.9))
        a = cv2.GaussianBlur(a, (0, 0), 0.7)
        mattes.append(np.clip(a, 0, 1))
    rows = -(-len(mattes) // COLS)
    sheet = np.full((rows * CH, COLS * CW), 255, np.uint8)
    for i, a in enumerate(mattes):
        cell = cv2.resize(a, (CW, CH), interpolation=cv2.INTER_AREA)
        sheet[(i // COLS) * CH:(i // COLS + 1) * CH, (i % COLS) * CW:(i % COLS + 1) * CW] = (255 * (1 - cell)).astype(np.uint8)
    cv2.imwrite(str(OUT / f'{track}.png'), sheet, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    # v = content hash, so a rebuilt matte is never served from a day-long cache.
    index[track] = {'frames': len(mattes), 'handFrames': int(sum(m.max() > 0.3 for m in mattes)),
                    'v': hashlib.sha256((OUT / f'{track}.png').read_bytes()).hexdigest()[:10]}
    if track == 'dealer' and False:  # review sheet disabled for the wide area
        for fi in ():
            src = frames[fi].astype(np.uint8)
            over = src.copy(); over[..., 1] = np.clip(over[..., 1] + 160 * mattes[fi], 0, 255).astype(np.uint8)
            samples.append(np.vstack([src, over, (255 * mattes[fi]).astype(np.uint8)[..., None].repeat(3, 2)]))

(Path(os.environ['MATTE_OUT']) / 'dealer-hand-matte.js' if 'MATTE_OUT' in os.environ else ROOT / 'public/dealer-hand-matte.js').write_text('// Generated by review/2026-09-28-soft-matte/build-matte.py.\nexport const DEALER_HAND_MATTE = ' + json.dumps({'x': X, 'y': Y, 'w': W, 'h': H, 'cw': CW, 'ch': CH, 'cols': COLS, 'tracks': index}) + ';\n')
print(json.dumps(index, indent=1))
