"""Silhouette fit of a dealer's card track (Kevin 10 Oct: "Paow's cards still need motion tracking work").

The game cuts the filmed white card out inside the track's quad and draws the real face there (dealer-layer.js), so a
quad that is too small leaves white prop beside the face and one that is too big hangs the face over the green.
Mocha fits the surface to the plane by eye; a blank card has no texture to track, so here every frame's quad is fitted
to its silhouette instead: per pixel the paper share a (1 = white card, 0 = green screen, in between = motion blur) is
read from how green it is, and the four corners move until the quad covers exactly that paper. Fingers, the sleeve and
anything else that is neither white nor green hide the card without cutting it, so they count for neither side; a part
of the card under the hand keeps the shape of the frame after (walked back from the landed card, as build-tracks.py).
Usage: python -I fit_silhouette.py <public dir> <dealer id> [take ...] [--fixes <file>] [--extend]   (rewrites <public>/dealer-card-tracks-<id>.js)
  --extend: the face starts as soon as his white card shows (Kevin 10 Oct, Dragge: the blank prop showed 2-3 frames before
  the face popped in): frames before the track's first one are fitted too, walking back while the card's face is clearly in view.
  --fixes: corners dragged on /review/dealer-cards.html (Download fixes) are kept as they are, and the frames before a
  fixed one are fitted again from it (Mocha: stop, fix, track on).
"""
import json, os, re, sys
import cv2, numpy as np
from scipy.optimize import least_squares

PUB, DID = sys.argv[1:3]
FIXES = {}
if '--fixes' in sys.argv:
    i = sys.argv.index('--fixes'); FIXES = json.load(open(sys.argv[i + 1]))['fixes']; del sys.argv[i:i + 2]
EXTEND = '--extend' in sys.argv
if EXTEND: sys.argv.remove('--extend')
ONLY = sys.argv[3:] or (list(FIXES) if FIXES else [])
PAD, SOFT, PRIOR = 30, .6, .35   # px around the quad, edge softness (px), corner pull towards the frame after (per px)
path = os.path.join(PUB, f'dealer-card-tracks-{DID}.js')
src = open(path).read()
head, body = src[:src.index('= ') + 2], src[src.index('= ') + 2:src.rindex(';')]
tracks = json.loads(body)
meta = json.load(open(os.path.join(PUB, f'media/dealers/{DID}/v2/meta.json')))
# the landing frames the game uses (dealers.js, from build-tracks.py): from there on the card lies still
ready = re.search(DID.upper() + r"_READY = \{ in: \d+, land: (\{[^}]*\})", open(os.path.join(PUB, 'dealers.js')).read()).group(1)
LAND = json.loads(re.sub(r"'?([a-z0-9]+)'?:", r'"\1":', ready))

def load(p):
    cap, out = cv2.VideoCapture(p), []
    while True:
        ok, x = cap.read()
        if not ok: return out
        out.append(x)

def paper_share(f):
    """a in [0, 1] (paper share) and w (1 where the pixel is white card or green screen, also in shadow; 0 on hands and sleeve)."""
    b, g, r = [f[..., i].astype(np.float32) for i in range(3)]
    e = g - np.maximum(r, b)                              # green excess: ~150 on the screen, ~0 on paper
    ratio = e / np.maximum(g, 1)                          # brightness-free, so the screen in shadow is still screen
    screen = np.median(ratio[ratio > .3]) if (ratio > .3).any() else .65
    a = np.clip(1 - ratio / screen, 0, 1)
    skin = (r - b > 22) & (r >= g - 5)
    dark = (np.maximum(np.maximum(r, g), b) < 80) & (ratio < .35)   # the black sleeve; the screen in the hand's shadow stays green
    w = (~skin & ~dark).astype(np.float32)
    return a, w

def inside(q, xs, ys):
    """Soft inside-ness of a convex quad (clockwise on screen) at pixel centres: 1 inside, 0 outside, ramp of ~2*SOFT px."""
    d = np.full(xs.shape, np.inf, np.float32)
    c = q.mean(0)
    for i in range(4):
        p0, p1 = q[i], q[(i + 1) % 4]
        t = p1 - p0; n = np.array([t[1], -t[0]]) / max(np.hypot(*t), 1e-6)
        if np.dot(n, c - p0) < 0: n = -n                 # inward normal
        d = np.minimum(d, (xs - p0[0]) * n[0] + (ys - p0[1]) * n[1])
    return 1 / (1 + np.exp(np.clip(-d / SOFT, -30, 30)))

def fit(frame, q0, prior):
    a, w = paper_share(frame)
    x0, y0 = np.floor(np.minimum(q0.min(0), prior.min(0)) - PAD).astype(int)
    x1, y1 = np.ceil(np.maximum(q0.max(0), prior.max(0)) + PAD).astype(int)
    H, W = a.shape; x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, W), min(y1, H)
    A, Wt = a[y0:y1, x0:x1], w[y0:y1, x0:x1]
    # only paper that belongs to this card: the blob(s) touching the starting quad (a shirt cuff or the shoe stay out)
    blobs = cv2.connectedComponents(((A > .5) & (Wt > 0)).astype(np.uint8))[1]
    ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32) + .5
    core = inside(q0, xs, ys) > .5
    keep = np.isin(blobs, [k for k in np.unique(blobs[core]) if k and (blobs == k)[core].sum() > .15 * (blobs == k).sum()])
    A = np.where((A > .5) & ~keep, 0, A)
    sw = np.sqrt(Wt).ravel()
    def res(v):
        q = v.reshape(4, 2)
        return np.concatenate([(inside(q, xs, ys).ravel() - A.ravel()) * sw, np.sqrt(PRIOR) * (q - prior).ravel()])
    r = least_squares(res, q0.ravel(), diff_step=.02, x_scale=1., max_nfev=400)
    q = r.x.reshape(4, 2)
    cut = inside(q, xs, ys)
    rim = float((A * (1 - cut) * Wt).sum() / np.linalg.norm(np.roll(q, -1, 0) - q, axis=1).sum())
    over = float(((1 - A) * cut * Wt).sum() / np.linalg.norm(np.roll(q, -1, 0) - q, axis=1).sum())
    fit.seen = float((A * cut * Wt).sum())   # white face in view inside the quad (px): the card face-on, not edge-on or its back
    return q, rim, over

report = {}
for k, t in tracks.items():
    if ONLY and k not in ONLY: continue
    centre = np.array(meta['centre']['dealer' if k in ('flip', 'dealerv') else k.rstrip('v')], float)
    take = 'flip' if k == 'flip' else ('posdealer' if k.startswith('dealer') else 'pos' + k[0]) + ('-v' if k.endswith('v') else '')
    fr = load(os.path.join(PUB, f'media/dealers/{DID}/v2/{take}.mp4'))
    f0, frames = t['firstFrame'], t['frames']
    land = LAND.get(k)
    out, after = {}, None
    for i in range(len(frames) - 1, -1, -1):          # backwards from the landed card, like the planar track
        f = f0 + i
        old = np.array(frames[i]['q'], float) + centre
        if land is not None and f >= land:
            out[i], after = old, old; continue           # at rest the track is the landed card already
        if str(f) in FIXES.get(k, {}):                   # set by hand: kept, and the frames before track on from it
            out[i] = after = np.array(FIXES[k][str(f)], float) + centre; continue
        # the frame after moved the card; its pose shifted by the old track's own motion is the shape prior
        prior = old if after is None else after + (old - np.array(frames[i + 1]['q'], float) - centre)
        best = None
        for start in (old, prior):
            q, rim, over = fit(fr[f], start, prior)
            if best is None or rim + over < best[1] + best[2]: best = (q, rim, over)
        out[i], after = best[0], best[0]
        report.setdefault(k, []).append((f, round(best[1], 2), round(best[2], 2)))
    for i, q in out.items():
        rel = [[round(float(x - centre[0]), 2), round(float(y - centre[1]), 2)] for x, y in q]
        frames[i]['q'] = frames[i]['p'] = frames[i]['body'] = rel
    if EXTEND:   # back from the first tracked frame while the card shows its face (at most 6 frames)
        rest = cv2.contourArea(out[len(frames) - 1].astype(np.float32)); added = []
        a1, a2 = out[0], out.get(1, out[0])
        for f in range(f0 - 1, max(f0 - 7, -1), -1):
            prior = a1 + .7 * (a1 - a2)
            best = None
            starts = [a1, prior]
            sa, sw_ = paper_share(fr[f]); n, lab, st, cen = cv2.connectedComponentsWithStats(((sa > .5) & (sw_ > 0)).astype(np.uint8))
            near = [k for k in range(1, n) if st[k, 4] > .3 * rest and np.hypot(*(cen[k] - a1.mean(0))) < 150]
            if near: starts.append(a1 + (cen[max(near, key=lambda k: st[k, 4])] - a1.mean(0)))   # moved fast: start on his white card where it is
            for start in starts:
                q, rim, over = fit(fr[f], start, start)
                if best is None or rim + over < best[1] + best[2]: best = (q, rim, over, fit.seen)
            q, rim, over, seen = best
            area = cv2.contourArea(q.astype(np.float32))
            if not (cv2.isContourConvex(q.astype(np.float32).reshape(-1, 1, 2)) and area > .45 * rest and seen > .5 * rest and rim + over < 2.5): break
            m = np.zeros(fr[f].shape[:2], np.uint8); cv2.fillPoly(m, [np.round(q).astype(np.int32)], 1)
            px = fr[f][m.astype(bool) & (paper_share(fr[f])[0] > .8)]
            paper = np.median(px[:, ::-1], 0).round().astype(int).tolist() if len(px) > 50 else frames[0]['paper']
            rel = [[round(float(x - centre[0]), 2), round(float(y - centre[1]), 2)] for x, y in q]
            frames.insert(0, {'q': rel, 'p': rel, 'body': [r[:] for r in rel], 'paper': paper}); t['firstFrame'] = f
            a2, a1 = a1, q; added.append((f, round(rim, 2), round(over, 2)))
        if added: print(f'{k:8s} face now from frame {t["firstFrame"]} (was {f0}): {added}', flush=True)
    worst = max(report.get(k, [(0, 0, 0)]), key=lambda r: r[1] + r[2])
    print(f'{k:8s} fitted {len(report.get(k, [])):2d} frames before landing, worst f{worst[0]} rim {worst[1]} over {worst[2]}', flush=True)

open(path, 'w').write(head + json.dumps(tracks, separators=(',', ':')) + ';\n')
