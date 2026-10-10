"""Planar (corner pin) tracker for the filmed prop card in a ready dealer's deal take (build-tracks.py runs it).
Per frame: the white face's quad (TL,TR,BR,BL, source px) = the smallest quadrilateral, built on the edges of the
visible paper's convex hull, that encloses it (a card held in perspective is a trapezoid, fingers on top only nick
the hull). The paper blob is followed BACKWARDS from the landed card, re-acquired along the way on a fast throw,
and the face counts as up only while the blob is as bright as the landed card (not the dark back mid-turn).
"""
import cv2, numpy as np, json, sys, itertools

def load(path):
    cap = cv2.VideoCapture(path); fr = []
    while True:
        ok, x = cap.read()
        if not ok: break
        fr.append(x)
    return fr

def classes(f):
    b, g, r = [f[..., i].astype(np.int16) for i in range(3)]
    lo = np.minimum(r, b)
    # neutral paper (also blended with the green screen by motion blur: r~b, g raised); skin has r well above b
    blend = (np.abs(r - b) < 20) & (lo > 100) & (g - np.maximum(r, b) < 60) & (g >= lo - 10)
    # the hand's shadow speckles the paper (compression): close the small gaps
    return cv2.morphologyEx(blend.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)).astype(bool)

def skin(f):
    b, g, r = [f[..., i].astype(np.int16) for i in range(3)]
    return ((r - b > 20) & (r > 90) & (r >= g)) | (np.maximum(np.maximum(r, g), b) < 60)   # fingers, or the dark sleeve

def order(q):
    c = q.mean(0); q = q[np.argsort(np.arctan2(q[:, 1] - c[1], q[:, 0] - c[0]))]
    return np.roll(q, -np.argmin(q.sum(1)), 0)

def edges(q): return np.linalg.norm(np.roll(q, -1, 0) - q, axis=1)

def area(q): return float(cv2.contourArea(np.asarray(q, np.float32)))

def enclosing_quad(hull):
    """Min-area quadrilateral whose sides lie on 4 of the hull's (simplified) edges and that encloses the hull."""
    h = cv2.approxPolyDP(hull.astype(np.float32), 1.2, True)[:, 0, :].astype(float)
    if len(h) < 4: return None
    if cv2.contourArea(h.astype(np.float32), oriented=True) < 0: h = h[::-1]
    n = len(h); E = [(h[i], h[(i + 1) % n]) for i in range(n)]
    def meet(a, b):
        (p, p2), (q, q2) = a, b; r, s = p2 - p, q2 - q; den = r[0] * s[1] - r[1] * s[0]
        if abs(den) < 1e-6: return None
        t = ((q - p)[0] * s[1] - (q - p)[1] * s[0]) / den; return p + t * r
    best = None; A0 = area(h)
    for idx in itertools.combinations(range(n), 4):
        pts = [meet(E[idx[i]], E[idx[(i + 1) % 4]]) for i in range(4)]
        if any(p is None for p in pts): continue
        q = np.array(pts); a = area(q)
        if a < A0 - 1 or (best and a >= best[0]): continue
        qc = q.astype(np.float32).reshape(-1, 1, 2)
        if all(cv2.pointPolygonTest(qc, (float(x), float(y)), True) > -1.0 for x, y in h):
            best = (a, q)
    return None if best is None else order(best[1])

def blob(paper, centre, A, maxd, ymin, prev=None):
    m = paper.astype(np.uint8).copy(); m[:ymin] = 0
    n, lab, st, cen = cv2.connectedComponentsWithStats(m); best = None
    for k in range(1, n):
        a = st[k, 4]; dd = np.hypot(*(cen[k] - centre))
        if a < .12 * A or a > 2.2 * A or dd > maxd: continue
        if prev is not None and a > 3 * prev: continue
        if best is None or dd < best[0]: best = (dd, k)
    return None if best is None else (lab == best[1])

def under_fingers(q, sk, ref):
    """Fingers on the card cut its visible paper short: push the side they cover outwards, at most to the card's
    own length (the rest pose), so the game's face is the whole card and the keyed fingers lie on top."""
    W, H = sorted(edges(ref))[1], sorted(edges(ref))[3]
    q = q.copy()
    for _ in range(2):
        e = edges(q); best = None
        for i in range(4):
            a, b2 = q[i], q[(i + 1) % 4]; d = b2 - a; L = np.linalg.norm(d); nrm = np.array([d[1], -d[0]]) / max(L, 1e-6)
            if np.dot(nrm, q.mean(0) - a) > 0: nrm = -nrm   # outward
            pts = [a + d * t + nrm * k for t in np.linspace(.1, .9, 9) for k in (2, 4, 6)]
            cov = np.mean([sk[int(p[1]), int(p[0])] if 0 <= int(p[1]) < sk.shape[0] and 0 <= int(p[0]) < sk.shape[1] else 0 for p in pts])
            if cov > .5 and (best is None or cov > best[0]): best = (cov, i, nrm)
        if best is None: break
        _, i, nrm = best
        span = abs(np.dot(q[(i + 2) % 4] - q[i], nrm)) * .5 + abs(np.dot(q[(i + 3) % 4] - q[(i + 1) % 4], nrm)) * .5
        full = H if edges(q)[i] < .5 * (W + H) * .9 else W   # a short side covered: the long dimension is missing
        grow = min(full - span, 40)
        if grow <= 1: break
        q[i] = q[i] + nrm * grow; q[(i + 1) % 4] = q[(i + 1) % 4] + nrm * grow
    return q

def track(fr, cx, cy, ymin=690, keyed=True):
    n = len(fr); last = fr[-1]
    m = blob(classes(last), np.array([cx, cy]), 7800, 60, ymin)
    cnt, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    hull = cv2.convexHull(max(cnt, key=cv2.contourArea))[:, 0, :] + .5
    ref = enclosing_quad(hull); A = area(ref)
    bright0 = np.median(np.min(last[m], axis=1))
    out = {}; c1 = c2 = ref.mean(0); prevA = m.sum()
    for f in range(n - 1, -1, -1):
        paper = classes(fr[f]); pred = c1 + (c1 - c2) * .8
        b = blob(paper, pred, A, 70, ymin, prevA)
        if b is None: b = blob(paper, pred, A, 260, ymin, prevA)
        if b is None: break
        bright = np.median(np.min(fr[f][b], axis=1))
        cnt, _ = cv2.findContours(b.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cnt = max(cnt, key=cv2.contourArea); hull = cv2.convexHull(cnt)[:, 0, :] + .5
        solid = cv2.contourArea(cnt) / max(1, area(hull))
        ring = cv2.dilate(b.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool) & ~b
        ys = np.where(ring)[0]; up = ring.copy(); up[int(np.median(np.where(b)[0])):] = False
        dark = (fr[f][up].max(1) < 60).mean() if up.any() else 0   # a shirt cuff hangs under the black sleeve, the card does not
        q = enclosing_quad(hull)
        if q is not None and keyed and dark > .33: break
        if q is not None: q = under_fingers(q, skin(fr[f]), ref)
        if q is None or area(q) > 2.2 * A or solid < .5 or bright < .5 * bright0: break
        if f + 1 in out and f + 2 in out and np.linalg.norm(out[f + 1][0].mean(0) - out[f + 2][0].mean(0)) < 3:
            # the card was at rest a frame later: if all its paper still lies inside that pose, it has not moved
            # (part of it is only in the hand's shadow)
            inside = np.zeros(b.shape, np.uint8); cv2.fillPoly(inside, [np.round(out[f + 1][0]).astype(np.int32)], 1)
            if (b & ~cv2.dilate(inside, np.ones((5, 5), np.uint8)).astype(bool)).sum() < 30: q = out[f + 1][0].copy()
        if area(q) > 1.08 * A:   # a motion-blurred smear: the card is its middle, at its own size
            c = q.mean(0); q = c + (q - c) * np.sqrt(1.08 * A / area(q))
        if out:   # keep the corner order of the frame after (no 90 degree jump of the artwork)
            nxt = out[min(out)][0]; q = min((np.roll(q, -k, 0) for k in range(4)), key=lambda r: np.abs(r - r.mean(0) - nxt + nxt.mean(0)).sum())
        out[f] = (q, round(float(bright / bright0), 3), round(float(solid), 3), int(b.sum()))
        c2, c1 = c1, q.mean(0); prevA = b.sum()
    # a dim blob is the face only between bright ones (motion blur over the green); the earliest dim ones are the turn
    while out and out[min(out)][1] < .8: del out[min(out)]
    return out, ref

def soft(f):
    return cv2.GaussianBlur(classes(f).astype(np.float32), (0, 0), 1.2)

def planar(fr, det, ref, pad=70):
    """Mocha-style planar track: the card is a plane, its pose a homography from the landed card (the clearest
    frame) to each frame, refined by ECC on the paper map and walked BACKWARDS from the landing. Fingers on the card
    count as card where the plane is expected (they occlude it, they do not cut it). The silhouette detection only
    seeds a frame where the card jumped (a throw) or ECC does not converge."""
    n = len(fr); last = n - 1
    x0, y0 = np.floor(ref.min(0) - pad).astype(int); x1, y1 = np.ceil(ref.max(0) + pad).astype(int)
    T = soft(fr[last])[y0:y1, x0:x1]; oT = np.array([x0, y0], float)
    tmask = np.zeros(T.shape, np.uint8); cv2.fillPoly(tmask, [np.round(ref - oT + [[-pad/2, -pad/2], [pad/2, -pad/2], [pad/2, pad/2], [-pad/2, pad/2]]).astype(np.int32)], 1)
    S = lambda o: np.array([[1, 0, o[0]], [0, 1, o[1]], [0, 0, 1]], float)
    corners = lambda H: cv2.perspectiveTransform(ref.reshape(-1, 1, 2).astype(np.float64), H).reshape(4, 2)
    Hs = {last: np.eye(3)}; out = {last: ref.copy()}
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 60, 1e-5)
    for f in range(last - 1, min(det) - 1, -1):
        prev = Hs[f + 1]
        if f + 2 in Hs:   # constant velocity in corner space
            c1, c2 = corners(Hs[f + 1]), corners(Hs[f + 2]); pred = cv2.getPerspectiveTransform(ref.astype(np.float32), (c1 + .7 * (c1 - c2)).astype(np.float32)).astype(float)
        else: pred = prev
        d = det.get(f)
        Hd = cv2.getPerspectiveTransform(ref.astype(np.float32), d.astype(np.float32)).astype(float) if d is not None else None
        init = Hd if Hd is not None and np.abs(corners(pred) - d).mean() > 10 else pred
        q0 = corners(init); c = q0.mean(0)
        I = soft(fr[f]); sk = skin(fr[f])
        exp = np.zeros(I.shape, np.uint8); cv2.fillPoly(exp, [np.round(q0).astype(np.int32)], 1)
        bb, gg, rr = [fr[f][..., i].astype(np.int16) for i in range(3)]
        I[(exp.astype(bool) & (gg - np.maximum(rr, bb) < 40))] = 1.   # a finger or its shadow over the plane hides paper, it does not cut it
        # same size as the template (OpenCV's ECC with a mask wants that), centred on the expected card
        h, w = T.shape; ix0, iy0 = int(round(c[0] - w / 2)), int(round(c[1] - h / 2))
        I = cv2.copyMakeBorder(I, h, h, w, w, cv2.BORDER_CONSTANT, value=0)[iy0 + h:iy0 + 2 * h, ix0 + w:ix0 + 2 * w]
        oI = np.array([ix0, iy0], float)
        W = S(-oI) @ init @ S(oT); W = (W / W[2, 2]).astype(np.float32)
        try:
            cc, W = cv2.findTransformECC(T, I, W, cv2.MOTION_HOMOGRAPHY, crit, tmask, 5)
            H = S(oI) @ W.astype(float) @ S(-oT); H /= H[2, 2]; q = corners(H)
            ok = cc > .55 and cv2.isContourConvex(q.astype(np.float32).reshape(-1, 1, 2)) and .2 * area(ref) < area(q) < 1.3 * area(ref)
            if d is not None and np.abs(q - d).mean() > 25: ok = False   # ECC slid off the card
        except cv2.error:
            ok = False
        if not ok:
            if d is None: break
            H, q = Hd, d
        Hs[f] = H; out[f] = q
    # the first frames of a throw can be a sliver of the card edge-on: the face starts on the first card-shaped one
    def angles(q):
        v1 = np.roll(q, 1, 0) - q; v2 = np.roll(q, -1, 0) - q
        return np.degrees(np.arccos(np.clip((v1 * v2).sum(1) / (np.linalg.norm(v1, axis=1) * np.linalg.norm(v2, axis=1) + 1e-9), -1, 1)))
    while len(out) > 1 and (area(out[min(out)]) < .35 * area(ref) or angles(out[min(out)]).min() < 40): del out[min(out)]
    # smoothing: a centred 3-tap on slow frames only (jitter goes, a fast throw keeps every frame's pose)
    sm = {}
    for f, q in out.items():
        if f - 1 in out and f + 1 in out and np.abs(out[f + 1] - out[f - 1]).max() < 8:
            sm[f] = .25 * out[f - 1] + .5 * q + .25 * out[f + 1]
        else: sm[f] = q
    return sm
