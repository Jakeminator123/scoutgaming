"""Clean plate for a stray filmed object on a keyed dealer's table (Kevin 10 Oct, "fix this": a dark red bar on the dealer's cards).

In Paow's dealer-hit take (posdealer-v, -iv) a thin dark red sliver slides out from under her left hand onto the top edge of the
dealer's card spot (frame 8 on) and her card lands on it with a red-brown corner still peeking out; the same corner peeks out of
her turned hole card (flip). It is neither green nor white, so the keyer (dealer-layer.js) keeps it on top of the game's cards,
and where it blurs with a card it turns pink and passes as skin inside the card's cut-out. A compositor paints such an object out
of the plate; on green screen the clean plate is the screen itself, so its pixels are painted back to the local screen green and
the keyer removes them. The object is told from her hand by colour: it is red over green with blue above green (the dark red core
and its pink blur with a card), while her skin and its creases always have green above blue. Its peeking corner is red-brown, so
inside a small box at that corner anything that is not screen, card paper or her light skin goes. The mask then grows 2 px into
its own dark edge (never into skin or paper) and is filled with the median screen green of a ring around it.
Decoded and encoded in the clips' own colour (bt709, tv range), x264 like the other keyed clips; frame count and tags unchanged.
Usage: python -I clean_plate.py <public dir> [--check]   (--check writes nothing to the game: masks and before/after only)
"""
import json, os, subprocess, sys
import cv2, numpy as np

PUB = sys.argv[1]
CHECK = '--check' in sys.argv
OUT = os.environ.get('CLEAN_PLATE_OUT', '/tmp/clean-plate')
# Per clip, segments of frames (indices in THAT clip). 'free': the sliver still sliding in, cleaned in a band below her
# fingertips and away from her skin. 'foot': the object lies still, so only its own footprint goes, measured on reference frames
# where nothing covers it (Mocha: track once, then reuse the shape), with an optional box where any non-screen colour is the object.
BAND = (488, 836, 604, 860)                                  # the sliver's band above the dealer's card spot, below her fingertips
SLIVER, HIT_CORNER = (488, 828, 604, 862), (562, 834, 592, 856)
FLIP_ZONE, FLIP_CORNER = (562, 820, 600, 852), (572, 826, 592, 846)
def hit(o): return [('free', BAND, None, None, 8 + o, 15 + o),
                    ('foot', SLIVER, None, (18 + o, 20 + o), 16 + o, 23 + o),          # until her card covers it
                    ('foot', SLIVER, HIT_CORNER, (25 + o, 31 + o), 22 + o, 38 + o)]    # the corner peeking out of the landed card
FLIP = [('foot', FLIP_ZONE, FLIP_CORNER, (36, 43), 36, 55)]   # from the turned card's landing on; before it her hand holds the card there
OBJECTS = {'paow/v2/posdealer-v.mp4': hit(0), 'paow/v2/posdealer-iv.mp4': hit(21),   # -iv: the same take after her 21-frame in-transition
           'paow/v2/flip.mp4': FLIP, 'paow/v2/flip-i.mp4': FLIP, 'paow/v2/flip-u.mp4': FLIP, 'paow/v2/flip-iu.mp4': FLIP}
W, H = 1080, 1920

def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', 'scale=in_color_matrix=bt709:in_range=tv,format=rgb24', '-f', 'rawvideo', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).copy()

def encode(frames, path):
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '24', '-i', '-',
                          '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
                          '-x264-params', 'keyint=48:min-keyint=48:scenecut=0:chroma-qp-offset=-3', '-profile:v', 'high',
                          '-colorspace', 'bt709', '-color_range', 'tv', '-an', '-movflags', '+faststart', path], stdin=subprocess.PIPE)
    p.communicate(frames.tobytes())
    if p.returncode: raise SystemExit(f'encode failed: {path}')

def classes(crop):
    x = crop.astype(np.float32) / 255; r, g, b = x[..., 0], x[..., 1], x[..., 2]
    lo, hi = x.min(-1), x.max(-1)
    screen = g - np.maximum(r, b) > .1
    paper = (lo > .62) & (hi - lo < .12)
    skin = (r >= g) & (g >= b - .01) & (lo > .40) & (r > .55)          # her fingers and nails: light, warm, green above blue
    red = (r - g > .12) & (b > g) & (r > .12)                          # the object's core and its pink blur; skin has g above b
    red |= (r > .2) & (g < .42 * r) & (r - b > .06) & (hi < .6)          # its darkest red (blue just under green)
    return screen, paper, skin, red

def object_px(crop, corner=None, at=(0, 0)):
    """The object's pixels in a crop: red over green with blue above green, plus (inside the corner box) anything that is not
    screen, card paper or her light skin, plus the dark core touching them; single pixels dropped."""
    screen, paper, skin, red = classes(crop)
    m = red & ~skin
    if corner:
        box = np.zeros(m.shape, bool); box[max(corner[1] - at[1], 0):corner[3] - at[1], max(corner[0] - at[0], 0):corner[2] - at[0]] = True
        m |= box & ~screen & ~paper                                     # (reference frames: no hand there, and its orange highlight looks like skin)
    dark = (crop.max(-1) < 77) & ~screen
    n, lab = cv2.connectedComponents((m | dark).astype(np.uint8))
    keep = np.unique(lab[m]); m = np.isin(lab, keep[keep > 0])          # dark only where it touches the red
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8))
    return np.isin(lab, [k for k in range(1, n) if st[k, 4] >= 4])

def grow(m, crop):
    screen, paper, skin, red = classes(crop)
    return m | (cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & ~skin & ~paper)   # its dark outline goes too

def mask_for(crop, mode, corner, at, foot):
    screen, paper, skin, red = classes(crop)
    if mode == 'free':
        near = cv2.dilate(skin.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
        m = grow(object_px(crop) & ~near, crop) & ~near
        dark = (crop.max(-1) < 115) & ~skin & ~paper                     # its thin dark rim while it slides (the screen is brighter)
        return m | (cv2.dilate(m.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool) & dark & ~near)
    nc, lab, st, _ = cv2.connectedComponentsWithStats(skin.astype(np.uint8))
    hand = np.isin(lab, [k for k in range(1, nc) if st[k, 4] >= 150])   # her hand, not the object's own skin-coloured highlight
    near = cv2.dilate(hand.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
    return foot & ~near & ~paper                                        # still: its footprint, wherever her hand or a card is not on it

def paint(f, zone, m):
    x0, y0, x1, y1 = zone
    crop = f[y0:y1, x0:x1]
    if not m.any(): return f, 0
    ring = cv2.dilate(m.astype(np.uint8), np.ones((13, 13), np.uint8)).astype(bool) & ~cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    c = crop.astype(np.int16); green = ring & ((c[..., 1] - np.maximum(c[..., 0], c[..., 2])) > 40)
    fill = np.median(crop[green], 0) if green.sum() > 20 else np.array([46, 226, 74])
    out = f.copy(); out[y0:y1, x0:x1][m] = fill.astype(np.uint8)
    return out, int(m.sum())

report = []
os.makedirs(OUT, exist_ok=True)
for rel, segments in OBJECTS.items():
    src = os.path.join(PUB, 'media/dealers', rel)
    orig = decode(src); fr = orig.copy(); n = len(fr); sizes = [0] * n
    for mode, zone, corner, refs, first, last in segments:
        x0, y0, x1, y1 = zone
        foot = None
        if refs:   # footprint: the object on its uncovered reference frames, grown over its edge
            foot = np.zeros((y1 - y0, x1 - x0), bool)
            for i in range(refs[0], refs[1] + 1):
                c = orig[i][y0:y1, x0:x1]; o = object_px(c, corner, (x0, y0))
                nc, lab, st, _ = cv2.connectedComponentsWithStats(o.astype(np.uint8))
                if nc > 1 and not corner: o = lab == 1 + int(np.argmax(st[1:, 4]))   # the sliver is its largest blob (her thumb's pink edge is not)
                foot |= grow(o, c)
            foot = cv2.dilate(foot.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
        for i in range(first, min(last, n - 1) + 1):
            m = mask_for(fr[i][y0:y1, x0:x1], mode, corner, (x0, y0), foot)
            fr[i], k = paint(fr[i], zone, m); sizes[i] += k
    tmp = os.path.join(OUT, rel.replace('/', '_'))
    encode(fr, tmp)
    new = decode(tmp)
    outside = np.ones((H, W), bool)
    for _, (x0, y0, x1, y1), *_ in segments: outside[y0 - 4:y1 + 4, x0 - 4:x1 + 4] = False
    mse = [float(((new[i][outside].astype(np.float32) - orig[i][outside]) ** 2).mean()) for i in range(n)]
    psnr = min(10 * np.log10(255 ** 2 / max(m, 1e-9)) for m in mse)
    # what is left of the object: red-over-green pixels in the zones of the painted frames
    left = max(int(object_px(new[i][z[1]:z[3], z[0]:z[2]]).sum()) for _, z, _, _, a, b in segments for i in range(a, min(b, n - 1) + 1))
    row = {'file': rel, 'frames': n, 'framesSame': len(new) == n, 'painted': ', '.join(f'{a}-{b}' for *_, a, b in segments),
           'maxMaskPx': max(sizes), 'psnrOutsideZone': round(psnr, 1), 'objectPxLeft': left}
    print(json.dumps(row), flush=True); report.append((row, segments, orig, new, sizes))
    if not CHECK and row['framesSame'] and psnr >= 40:
        os.replace(tmp, src)

# before/after sheets of the zone at 3x, every painted frame (top: original, bottom: cleaned)
for row, segments, orig, new, sizes in report:
    x0, y0, x1, y1 = segments[-1][1] if 'flip' in row['file'] else SLIVER
    idx = [i for i, k in enumerate(sizes) if k][:32]
    if not idx: continue
    tiles = []
    for i in idx:
        a, b2 = orig[i][y0 - 20:y1 + 20, x0 - 20:x1 + 20], new[i][y0 - 20:y1 + 20, x0 - 20:x1 + 20]
        t = cv2.resize(np.vstack([a, b2]), None, fx=3, fy=3, interpolation=cv2.INTER_NEAREST)[..., ::-1].copy()
        cv2.putText(t, str(i), (3, 14), cv2.FONT_HERSHEY_SIMPLEX, .45, (0, 255, 255), 1); tiles.append(t)
    tiles += [np.zeros_like(tiles[0])] * (-len(tiles) % 8)
    cv2.imwrite(os.path.join(OUT, row['file'].replace('/', '_') + '.jpg'), np.vstack([np.hstack(tiles[k:k + 8]) for k in range(0, len(tiles), 8)]))
