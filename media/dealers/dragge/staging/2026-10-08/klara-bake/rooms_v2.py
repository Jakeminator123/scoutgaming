"""Rooms for the ready-pose dealers (Dragan v2, Paow; H3's KLARA plates of 2026-10-07).

Their plates have a bigger shoe further right (mouth ~(835,760)) than Astrid's room, and they are
at Astrid's size already (no warp in the game). The producers' preview (hela_bordet_komp.mp4) shows
that shoe on Astrid's table, so the shoe is lifted from the preview's first frame (dealer at rest,
hands clear of the shoe) and put on every room: the old shoe is replaced by the shoe-less table,
the new shoe pasted inside its own hull. Where the dealer covers the preview, the other preview
fills in; the shoe's black card mouth comes with the dealer footage (it is not green).
Usage: python rooms_v2.py <game public dir>
"""
import cv2, numpy as np, sys, os

PUB = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(PUB, 'media/dealers/rooms-v2'); os.makedirs(OUT, exist_ok=True)
noshoe = cv2.imread(os.path.join(HERE, 'rooms/noshoe-aligned.png')).astype(np.float32)
clean = cv2.imread(os.path.join(HERE, 'astrid-room-clean.png')).astype(np.float32)

def alpha(x):
    x = x.astype(np.float32) / 255; g = x[..., 1] - np.maximum(x[..., 0], x[..., 2]); return 1 - np.clip((g - .03) / .13, 0, 1)

acc, wts = 0, 0
for name, plate in [('preview-dragan.mp4', 'dragan'), ('preview-paow.mp4', 'paow')]:
    ok, f0 = cv2.VideoCapture(os.path.join(HERE, 'rooms-v2', name)).read()
    a = alpha(cv2.imread(os.path.join(HERE, f'plates/{plate}/VILA.png')))
    free = (cv2.dilate((a > .02).astype(np.uint8), np.ones((9, 9), np.uint8)) == 0).astype(np.float32)
    # the shoe's black mouth is dealer footage in both plates: take the preview pixels there too
    mouth = np.zeros_like(free); mouth[680:830, 760:900] = 1
    w = np.maximum(free, mouth * (a > .02)) if plate == 'dragan' else free
    acc = acc + f0.astype(np.float32) * w[..., None]; wts = wts + w
bg = acc / np.maximum(wts, 1e-3)[..., None]
diff = np.abs(bg - noshoe).max(axis=2) * (wts > 0)
box = np.zeros(diff.shape, np.uint8); box[560:832, 640:1080] = 1          # stops above the lettering
m = ((diff > 22) & (box > 0)).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(m)
m = np.isin(lab, [k for k in range(1, n) if st[k, 4] > 400]).astype(np.uint8)   # the shoe, not speckle
hull = cv2.convexHull(cv2.findNonZero(m))
shoe = np.zeros(m.shape, np.uint8); cv2.fillConvexPoly(shoe, hull, 1)
shoe = cv2.dilate(shoe, np.ones((5, 5), np.uint8))
sa = cv2.GaussianBlur(shoe.astype(np.float32), (0, 0), 1.5)[..., None]
bg = np.where((wts > 0)[..., None], bg, noshoe)                              # never a hole

# The shoe-less table exactly as rooms.py builds it: the clean room's own shoe swapped for the
# shoe-less edit inside its footprint, plus the footprint of the shoe rooms.py moved for Dragge v1.
base = clean
d0 = np.abs(clean - noshoe).max(axis=2)
own = np.zeros(d0.shape, np.uint8); own[620:822, 720:1060] = d0[620:822, 720:1060] > 25
own = cv2.dilate(cv2.morphologyEx(own, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8)), np.ones((9, 9), np.uint8))
sa0 = cv2.GaussianBlur(own.astype(np.float32), (0, 0), 3)[..., None]
table0 = base * (1 - sa0) + noshoe * sa0
moved = cv2.warpAffine(cv2.dilate(own, np.ones((11, 11), np.uint8)).astype(np.float32), np.float32([[1, 0, 783 - 805], [0, 1, 829 - 765]]), (1080, 1920))
keep = np.zeros(d0.shape, np.float32); keep[700:] = 1
keep = np.maximum(cv2.GaussianBlur(keep, (0, 0), 6), cv2.GaussianBlur(moved, (0, 0), 3))[..., None]

for room in ['darkhall', 'mahogany', 'golden', 'azure']:
    src = cv2.imread(os.path.join(PUB, f'media/dealers/rooms/{room}.png')).astype(np.float32)
    shoeless = src * (1 - keep) + table0 * keep          # every trace of the old shoes gone
    out = (shoeless * (1 - sa) + bg * sa).clip(0, 255).astype(np.uint8)
    cv2.imwrite(os.path.join(OUT, f'{room}.png'), out)
    cv2.imwrite(os.path.join(OUT, f'{room}-thumb.jpg'), cv2.resize(out[0:700], (180, 117), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])
    print(room, 'new-shoe px', int((sa[..., 0] > .5).sum()))
