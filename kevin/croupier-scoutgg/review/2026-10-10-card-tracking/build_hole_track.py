"""Track for a ready dealer's face-down hole card (Kevin 10 Oct: "her second card is still half when it's on the backside").

The hole take films a dark-backed card slid in under the dealer's fingers; it stands up as it settles and rests on the dealer's
spot. With no 'hole' track the game drew its own back only from the landing frame, so before that her filmed card lay over the
game's up card, half of it showing. This adds a 'hole' track the same way the face-up ones work: the game paints its back on
the filmed card (corner pin) and the dealer layer cuts the filmed one out. The card is fitted to its silhouette like
fit_silhouette.py, only here the card is anything that is not screen green and not skin (the back is dark, not white):
the resting card of the last frame is the reference, and each frame before it is fitted walking back while the card is in
view, the part under her fingers keeping the shape of the frame after.
Usage: python -I build_hole_track.py <public dir> <dealer id>   (adds 'hole' to <public>/dealer-card-tracks-<id>.js)
"""
import json, os, sys
import cv2, numpy as np
from scipy.optimize import least_squares
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # planar_track.py next to this file
from planar_track import enclosing_quad

PUB, DID = sys.argv[1:3]
PAD, SOFT, PRIOR = 30, .6, .35
path = os.path.join(PUB, f'dealer-card-tracks-{DID}.js')
src = open(path).read(); head, body = src[:src.index('= ') + 2], src[src.index('= ') + 2:src.rindex(';')]
tracks = json.loads(body)
meta = json.load(open(os.path.join(PUB, f'media/dealers/{DID}/v2/meta.json')))
centre = np.array(meta['centre']['hole'], float)

def load(p):
    cap, out = cv2.VideoCapture(p), []
    while True:
        ok, x = cap.read()
        if not ok: return out
        out.append(x)

def card_share(f):
    """a: share of a pixel that is card (not screen green), w: 1 except on her skin."""
    b, g, r = [f[..., i].astype(np.float32) for i in range(3)]
    ratio = (g - np.maximum(r, b)) / np.maximum(g, 1)
    screen = np.median(ratio[ratio > .3]) if (ratio > .3).any() else .65
    a = np.clip(1 - ratio / screen, 0, 1)
    skin = (r - b > 22) & (r >= g - 5) & (np.maximum(np.maximum(r, g), b) > 110)   # her fingers (the card's red-brown border is darker)
    return a, (~skin).astype(np.float32)

def inside(q, xs, ys):
    d = np.full(xs.shape, np.inf, np.float32); c = q.mean(0)
    for i in range(4):
        p0, p1 = q[i], q[(i + 1) % 4]; t = p1 - p0; n = np.array([t[1], -t[0]]) / max(np.hypot(*t), 1e-6)
        if np.dot(n, c - p0) < 0: n = -n
        d = np.minimum(d, (xs - p0[0]) * n[0] + (ys - p0[1]) * n[1])
    return 1 / (1 + np.exp(np.clip(-d / SOFT, -30, 30)))

def fit(frame, q0, prior):
    a, w = card_share(frame)
    x0, y0 = np.floor(np.minimum(q0.min(0), prior.min(0)) - PAD).astype(int); x1, y1 = np.ceil(np.maximum(q0.max(0), prior.max(0)) + PAD).astype(int)
    H, W = a.shape; x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W), min(y1, H)
    A, Wt = a[y0:y1, x0:x1], w[y0:y1, x0:x1]
    blobs = cv2.connectedComponents(((A > .5) & (Wt > 0)).astype(np.uint8))[1]
    ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32) + .5
    core = inside(q0, xs, ys) > .5
    keep = np.isin(blobs, [k for k in np.unique(blobs[core]) if k and (blobs == k)[core].sum() > .15 * (blobs == k).sum()])
    A = np.where((A > .5) & ~keep, 0, A)            # her black sleeve or another object off the card stays out
    sw = np.sqrt(Wt).ravel()
    res = lambda v: np.concatenate([(inside(v.reshape(4, 2), xs, ys).ravel() - A.ravel()) * sw, np.sqrt(PRIOR) * (v.reshape(4, 2) - prior).ravel()])
    q = least_squares(res, q0.ravel(), diff_step=.02, max_nfev=400).x.reshape(4, 2)
    cut = inside(q, xs, ys); per = np.linalg.norm(np.roll(q, -1, 0) - q, axis=1).sum()
    return q, float((A * (1 - cut) * Wt).sum() / per), float(((1 - A) * cut * Wt).sum() / per), float((A * cut * Wt).sum())

fr = load(os.path.join(PUB, f'media/dealers/{DID}/v2/hole.mp4')); n = len(fr)
# reference: the resting card in the last frame, its enclosing quad
a, w = card_share(fr[-1])
cnt = cv2.connectedComponentsWithStats(((a > .5) & (w > 0)).astype(np.uint8))
lab, st, cen = cnt[1], cnt[2], cnt[3]
k = min(range(1, cnt[0]), key=lambda k: np.hypot(*(cen[k] - centre)) if st[k, 4] > 2000 else 1e9)
hull = cv2.convexHull(np.argwhere(lab == k)[:, ::-1].astype(np.float32))[:, 0, :] + .5
ref = enclosing_quad(hull); rest = cv2.contourArea(ref.astype(np.float32))
out = {n - 1: ref}; after, after2 = ref, ref
for f in range(n - 2, -1, -1):
    prior = after + .5 * (after - after2)
    best = None
    starts = [after, prior]
    sa, sw_ = card_share(fr[f]); nb, lb, sb, cb = cv2.connectedComponentsWithStats(((sa > .5) & (sw_ > 0)).astype(np.uint8))
    near = [k for k in range(1, nb) if sb[k, 4] > .15 * rest and np.hypot(*(cb[k] - after.mean(0))) < 120]
    if near: starts.append(after + (cb[max(near, key=lambda k: sb[k, 4])] - after.mean(0)))   # slid fast: start on the card where it is
    for start in starts:
        q, rim, over, seen = fit(fr[f], start, prior)
        if best is None or rim + over < best[1] + best[2]: best = (q, rim, over, seen)
    q, rim, over, seen = best
    area = cv2.contourArea(q.astype(np.float32))
    if not (cv2.isContourConvex(q.astype(np.float32).reshape(-1, 1, 2)) and area > .3 * rest and seen > .25 * rest and rim + over < 4): break
    out[f] = q; after2, after = after, q
first = min(out)
rel = lambda q: [[round(float(x - centre[0]), 2), round(float(y - centre[1]), 2)] for x, y in q]
tracks['hole'] = {'firstFrame': first, 'frames': [{'q': rel(out[f]), 'p': rel(out[f]), 'body': rel(out[f]), 'paper': [5, 4, 4]} for f in range(first, n)]}
open(path, 'w').write(head + json.dumps(tracks, separators=(',', ':')) + ';\n')
print(f'{DID} hole: frames {first}-{n - 1} tracked, card area {rest:.0f} px, centre offset of rest {np.round(ref.mean(0) - centre, 1).tolist()}')
