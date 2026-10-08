"""Track the dealer's hand with SAM 2 (Segment Anything 2, Meta) and rewrite the mattes.

Run AFTER build-matte.py: its colour/Vision matte seeds SAM 2 on the frames where
the hand is clearest, then SAM 2 tracks that object (shape + motion, not colour)
forwards and backwards through the whole clip. White prop paper stays vetoed.

Needs: torch, sam2 (github.com/facebookresearch/sam2), the sam2.1_hiera_small.pt
checkpoint. Usage: python sam2-matte.py <checkpoint> [track ...]
"""
import sys, os, json, hashlib, tempfile
import cv2, numpy as np, torch
from pathlib import Path
from sam2.build_sam import build_sam2_video_predictor

ROOT = Path(__file__).resolve().parents[2]
# MATTE_OUT writes elsewhere so a running game keeps its mattes until reviewed.
OUT = Path(os.environ.get('MATTE_OUT', ROOT / 'public/media/deal/matte'))
REVIEW = Path(__file__).resolve().parent
_mj = Path(os.environ['SEED_DIR']) / 'dealer-hand-matte.js' if 'SEED_DIR' in os.environ else ROOT / 'public/dealer-hand-matte.js'
meta = json.loads(_mj.read_text().split('= ', 1)[1].rstrip(';\n'))
X, Y, W, H, COLS = meta['x'], meta['y'], meta['w'], meta['h'], meta['cols']
PW, PH = meta['cw'], meta['ch']  # stored cell size (half resolution)
# SAM 2 sees the whole table plus her arms above it.
CX, CY, CW, CH = 0, 600, 1080, 660
CACHE = Path(__file__).resolve().parent / 'sam2-cache'  # raw logits, not committed
device = 'mps' if torch.backends.mps.is_available() else 'cpu'
predictor = build_sam2_video_predictor('configs/sam2.1/sam2.1_hiera_s.yaml', sys.argv[1], device=device)
manifest = json.loads((ROOT / 'public/media/manifest.json').read_text())

def ramp(v, lo, hi):
    return np.clip((v - lo) / (hi - lo), 0, 1)

def read_seed(track, n):
    # SEED_DIR lets the game keep serving the current mattes while this runs.
    sheet = cv2.imread(str(Path(os.environ.get('SEED_DIR', OUT)) / f'{track}.png'), 0)
    return [cv2.resize(1 - sheet[(i // COLS) * PH:(i // COLS + 1) * PH, (i % COLS) * PW:(i % COLS + 1) * PW] / 255., (W, H), interpolation=cv2.INTER_LINEAR) for i in range(n)]

def moved(plate, frame):
    """The hand is not in the first frame, so pixels that never change from it
    (table lettering, felt) are never hand, whatever the tracker thinks."""
    d = np.abs(cv2.GaussianBlur(frame[Y:Y + H, X:X + W], (5, 5), 0).astype(np.float32)
               - cv2.GaussianBlur(plate[Y:Y + H, X:X + W], (5, 5), 0).astype(np.float32)).max(axis=2)
    m = ramp(d, 8, 18)
    # Grow slightly so a soft finger edge over similar felt is not eaten.
    return cv2.GaussianBlur(cv2.dilate(m, np.ones((5, 5), np.uint8)), (0, 0), 1.0)

def skin_blobs(a, frame):
    """Keep only tracked blobs that contain real skin (red clearly above green),
    so a tracked table letter can never cover a card."""
    f = frame[Y:Y + H, X:X + W].astype(np.float32); b, g, r = f[..., 0], f[..., 1], f[..., 2]
    skin = (r > 95) & (r - g > 25) & (r - b > 20)
    n, lab = cv2.connectedComponents((a > .5).astype(np.uint8))
    keep = np.zeros(a.shape, np.uint8)
    for i in range(1, n):
        if (skin & (lab == i)).sum() >= 30: keep[lab == i] = 1
    return a * cv2.dilate(keep, np.ones((5, 5), np.uint8))

def sleeve_seed(plate, frame):
    """Clicks on her dark blazer sleeve: dark, changed from the empty table, and
    attached to the top/side edge (the arm enters from outside; the dark prop
    card lies in the middle). Returns (points, labels) in crop coords, or None."""
    f = cv2.GaussianBlur(frame[Y:Y + H, X:X + W], (5, 5), 0).astype(np.float32)
    p = cv2.GaussianBlur(plate[Y:Y + H, X:X + W], (5, 5), 0).astype(np.float32)
    m = ((np.abs(f - p).max(axis=2) > 14) & (f.max(axis=2) < 32)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    keep = np.zeros_like(m)
    for i in range(1, n):
        x, y, w, h, area = st[i]
        if area >= 300 and (y == 0 or x == 0 or x + w == W): keep[lab == i] = 1
    if keep.sum() < 300: return None
    dist = cv2.distanceTransform(keep, cv2.DIST_L2, 5); pos = []
    for _ in range(3):
        y, x = np.unravel_index(np.argmax(dist), dist.shape)
        if dist[y, x] < 3: break
        pos.append((x, y)); cv2.circle(dist, (int(x), int(y)), 16, 0, -1)
    # 'not sleeve' on felt that did not change
    calm = cv2.distanceTransform((np.abs(f - p).max(axis=2) < 6).astype(np.uint8), cv2.DIST_L2, 5)
    y, x = np.unravel_index(np.argmax(calm), calm.shape); neg = [(x, y)] if calm[y, x] > 10 else []
    pts = np.array([(x + X - CX, y + Y - CY) for x, y in pos + neg], np.float32)
    return pts, np.array([1] * len(pos) + [0] * len(neg), np.int32), int(keep.sum())

def sleeve_guard(plate, frame):
    """Sleeve only where the table got darker (never letters, never the brown prop)."""
    f = cv2.GaussianBlur(frame[Y:Y + H, X:X + W], (5, 5), 0).astype(np.float32)
    p = cv2.GaussianBlur(plate[Y:Y + H, X:X + W], (5, 5), 0).astype(np.float32)
    g = ramp(np.abs(f - p).max(axis=2), 10, 20) * ramp(45 - f.max(axis=2), 0, 15)
    return cv2.GaussianBlur(cv2.dilate(g, np.ones((3, 3), np.uint8)), (0, 0), 0.8)

def seed_points(a, frame):
    """Clicks like a person would give SAM 2: 'hand' on the clearest skin,
    'not hand' on empty felt and on the white prop card."""
    core = (a > .9).astype(np.uint8)
    dist = cv2.distanceTransform(core, cv2.DIST_L2, 5)
    pos = []
    for _ in range(3):
        y, x = np.unravel_index(np.argmax(dist), dist.shape)
        if dist[y, x] < 3: break
        pos.append((x, y)); cv2.circle(dist, (int(x), int(y)), 14, 0, -1)
    far = cv2.distanceTransform((a < .05).astype(np.uint8), cv2.DIST_L2, 5)
    neg = []
    for _ in range(2):
        y, x = np.unravel_index(np.argmax(far), far.shape)
        if far[y, x] < 12: break
        neg.append((x, y)); cv2.circle(far, (int(x), int(y)), 40, 0, -1)
    crop = frame[Y:Y + H, X:X + W].astype(int)
    white = (crop.min(axis=2) > 170) & (np.abs(crop[..., 2] - crop[..., 0]) < 14)
    if white.sum() > 300:
        ys, xs = np.nonzero(white); neg.append((int(xs.mean()), int(ys.mean())))
    pts = np.array([(x + X - CX, y + Y - CY) for x, y in pos + neg], np.float32)
    return pts, np.array([1] * len(pos) + [0] * len(neg), np.int32)

index, samples = {}, []
ONLY = set(sys.argv[2:])
for clip in manifest['deal']:
    track = clip['id'].replace('deal_pos', '').replace('deal_', '')
    if ONLY and track not in ONLY:
        old = meta['tracks'].get(track); index[track] = old; continue
    cap = cv2.VideoCapture(str(ROOT / ('public' + clip['url']))); frames = []
    while True:
        ok, bgr = cap.read()
        if not ok: break
        frames.append(bgr)
    cap.release()
    n = len(frames); seed = read_seed(track, n)
    area = np.array([(s > .5).sum() for s in seed])
    mattes = [np.zeros((H, W), np.float32) for _ in range(n)]; sleeve_frames = []
    if area.max() >= 150:
        # Seed on up to three clear frames, spread across the clip.
        order = [int(i) for i in np.argsort(-area) if area[i] >= 150]
        seeds = []
        for i in order:
            if all(abs(i - j) >= 8 for j in seeds): seeds.append(i)
            if len(seeds) == 3: break
        with tempfile.TemporaryDirectory() as t:
            for i, f in enumerate(frames):
                cv2.imwrite(f'{t}/{i:05d}.jpg', f[CY:CY + CH, CX:CX + CW], [cv2.IMWRITE_JPEG_QUALITY, 95])
            # One object per run: Apple's MPS backend aborts on multi-object batches.
            hand_clicks = [(i, *seed_points(seed[i], frames[i])) for i in seeds]
            sl = sorted([(i, r) for i, r in ((i, sleeve_seed(frames[0], frames[i])) for i in range(n)) if r],
                        key=lambda t: -t[1][2])
            sleeve_clicks = []
            for i, r in sl:
                if all(abs(i - j) >= 8 for j, *_ in sleeve_clicks): sleeve_clicks.append((i, r[0], r[1]))
                if len(sleeve_clicks) == 3: break
            sleeve_frames = [i for i, *_ in sleeve_clicks]
            logits = {}
            for oid, clicks in ((1, hand_clicks), (2, sleeve_clicks)):
                if not clicks: continue
                with torch.inference_mode():
                    state = predictor.init_state(video_path=t)
                    for i, pts, lab in clicks:
                        predictor.add_new_points_or_box(state, frame_idx=i, obj_id=1, points=pts, labels=lab)
                    for reverse in (False, True):
                        for fi, _, out in predictor.propagate_in_video(state, reverse=reverse):
                            l = out[0, 0].float().cpu().numpy(); key = (fi, oid)
                            logits[key] = l if key not in logits else np.maximum(logits[key], l)
                    predictor.reset_state(state); del state
                    if device == 'mps': torch.mps.empty_cache()
        CACHE.mkdir(exist_ok=True)
        np.savez_compressed(CACHE / f'{track}.npz', **{f'{fi}_{oid}': l[Y - CY:Y - CY + H, X - CX:X - CX + W].astype(np.float16) for (fi, oid), l in logits.items()})
        for (fi, oid), l in sorted(logits.items(), key=lambda t: t[0][1] != 1):
            prob = 1 / (1 + np.exp(-l))[Y - CY:Y - CY + H, X - CX:X - CX + W]
            if oid == 2:  # sleeve: only where the table really got darker
                sleeve = (prob > .5).astype(np.float32) * sleeve_guard(frames[0], frames[fi])
                # Her sleeve enters from the edge of the area; a dark prop card lies inside it.
                n2, lab2, st2, _ = cv2.connectedComponentsWithStats((sleeve > .3).astype(np.uint8), 8)
                edge = np.zeros(sleeve.shape, np.float32)
                for k in range(1, n2):
                    x2, y2, w2, h2, _ = st2[k]
                    if y2 == 0 or x2 == 0 or x2 + w2 == W: edge[lab2 == k] = 1
                sleeve = sleeve * cv2.dilate(edge, np.ones((5, 5), np.uint8))
                # Close speckles where the blurred sleeve crosses the lettering, then feather.
                sleeve = cv2.morphologyEx(sleeve, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
                sleeve = cv2.GaussianBlur(sleeve, (0, 0), 0.9)
                mattes[fi] = np.maximum(mattes[fi], np.clip(sleeve, 0, 1)); continue
            f = cv2.GaussianBlur(frames[fi][Y:Y + H, X:X + W], (3, 3), 0).astype(np.float32)
            b, g, r = f[..., 0], f[..., 1], f[..., 2]
            # The white prop card is never hand, whatever the tracker thinks.
            paper = ramp(np.minimum(np.minimum(r, g), b), 150, 190) * (1 - ramp(r - b, 6, 14))
            solid = (prob > .5).astype(np.uint8)
            grown = cv2.dilate(solid, np.ones((3, 3), np.uint8)).astype(np.float32)
            a = cv2.GaussianBlur(grown, (0, 0), 0.9) * (1 - paper)
            mattes[fi] = skin_blobs(np.clip(a * moved(frames[0], frames[fi]), 0, 1), frames[fi])
    rows = -(-n // COLS)
    sheet = np.full((rows * PH, COLS * PW), 255, np.uint8)
    for i, a in enumerate(mattes):
        cell = cv2.resize(a, (PW, PH), interpolation=cv2.INTER_AREA)
        sheet[(i // COLS) * PH:(i // COLS + 1) * PH, (i % COLS) * PW:(i % COLS + 1) * PW] = (255 * (1 - cell)).astype(np.uint8)
    cv2.imwrite(str(OUT / f'{track}.png'), sheet, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    index[track] = {'frames': n, 'handFrames': int(sum(m.max() > 0.3 for m in mattes)),
                    'v': hashlib.sha256((OUT / f'{track}.png').read_bytes()).hexdigest()[:10]}
    print(track, 'seeds', seeds if area.max() >= 150 else [], 'sleeve', sleeve_frames if area.max() >= 150 else [], index[track], flush=True)

(OUT / 'dealer-hand-matte.js' if 'MATTE_OUT' in os.environ else ROOT / 'public/dealer-hand-matte.js').write_text('// Generated by review/2026-09-28-soft-matte/build-matte.py + sam2-matte.py.\nexport const DEALER_HAND_MATTE = '
    + json.dumps({'x': X, 'y': Y, 'w': W, 'h': H, 'cw': PW, 'ch': PH, 'cols': COLS, 'tracks': index}) + ';\n')
