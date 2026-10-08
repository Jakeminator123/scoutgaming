#!/usr/bin/env python3
"""Bake one KLARA green deal bank (MiniMax H3 takes, delivered 2026-10-07) into opaque portrait films.

One film per take: in_vila_till_redo + deal_posN without its frame 0 + ut_redo_till_vila without its
frame 0. Every film therefore starts on VILA and ends on VILA with the card on its seat, like
Astrid's bank, and plays rest -> deal -> rest on the portrait lane with no player change.

Each frame is decoded as BT.709 (ffmpeg, rgb24), keyed with the dealer-layer key of the H3 preview game
(croupier-dragge-live public/dealer-layer.js at scale 1: alpha = 1 - smoothstep(.03, .16, g - max(r, b))
on a 1.5 px five-tap cross, green despill), and laid over darkhall.png. Nothing else is removed, so the
prop card and the acrylic shoe stay. For the ut part the landed prop (keyed pixels of the card component
at the seat in the deal's last frame) is pasted into the plate under the dealer. Frames go back to
ffmpeg as rgb24 and are encoded like Astrid's bank: H.264 crf 12, preset slow, yuv420p, BT.709, 24 fps,
faststart, no audio.

Also writes rest.png (VILA.png keyed over the plate), poster.jpg (its upper square) and
kortpositioner.json, then decodes every film again and records the checks in receipt.json.

Usage: python -I build.py --dealer dragge --delivery <KLARA_DRAGAN/produktion> --out <new directory>
Review <out>/bank, copy it into media/dealers/<dealer>/runtime/presentation/ and keep
<out>/receipt.json next to this script.
"""
import argparse, hashlib, json, os, platform, subprocess, sys
import cv2, numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1080, 1920
PLATE = ('darkhall.png', '33dbde8e76ea74163345106a2e6a4496afa77126f9963501c7e9c5300a0eab3c')
PLATE_SCRIPT = ('rooms_v2.py', '43f5470eda0c600147185580398b1352b06d14612bb809312712f60043e33194')
# Landing centres of Astrid's bank (kortpositioner.json); H3's own KLARA metadata uses the same.
CENTRES = {'1': (110, 1025), '2': (253, 1075), '3': (396, 1105), '4': (540, 1115), '5': (684, 1105),
           '6': (827, 1075), '7': (970, 1025), 'dealer': (540, 895)}
CARD = (79, 106)
SEATS = [(f'deal_pos{n}', f'deal/deal_pos{n}/deal_pos{n}.mp4', str(n), 'white') for n in range(1, 8)]
DEALERS = {
    'dragge': {
        'takes': SEATS + [('deal_posdealer', 'deal/deal_posdealer/deal_posdealer.mp4', 'dealer', 'white'),
                          ('deal_poshole', 'deal/deal_hole/deal_hole.mp4', 'dealer', 'black')],
        'inputs': {
            'VILA.png': 'b83b74adddd722ea8829be6ceb2ada9c9b9a64d09d32a65d0d9fec8003786744',
            'REDO.png': '6558929d3d1b76ba0438b7dc4716fbeb0615bfbc2715d671f64a8ccf70da7958',
            'in_vila_till_redo.mp4': 'd14496eee70f51772a12552f885ce70c56c53090a90d8c6b0a1148b628737a8e',
            'ut_redo_till_vila.mp4': '23bccced267bbbcb6e793890cdda2200730a11e874b7798f04bd2cb96b14c19b',
            'deal_pos1.mp4': '3756c33ccd2c2f8074bca1631852bc9d84aee7c84cf6b138747fb57e1f532c3e',
            'deal_pos2.mp4': '7397c3ee737923353c195338dbfd13a14703192e5098b6f266187e235a81ef9a',
            'deal_pos3.mp4': '7521c3aa9c917a89f49c2f56dc0dd271c2b11ea5c8eed03b4522dbb6a102521a',
            'deal_pos4.mp4': 'ec40ab5f5a0d294d3f15102fc2806df1f5cf179826ceee1c9086dd98b20a1aad',
            'deal_pos5.mp4': 'f2fb80e2163dacd21eae96f99bcdb54273374d13b3cc958ecedc98bc5931c54e',
            'deal_pos6.mp4': '8181e12bb0dcc4f9d80ab070cddfffc309740777c167d31daff78dff65f049aa',
            'deal_pos7.mp4': '6732735a4ad095a37ffb77d6970099d0a8a646f3f76b85c1c667dc1c1c1abb5c',
            'deal_posdealer.mp4': 'c07be8043d07544c92f24bd098fec10ce5d3f9e541eda89bee209dc65e215a12',
            'deal_poshole.mp4': 'a2e1e5f387ac22bb9948f1c8b9d2fe8d2f80596fc30cf9e8614d8a51562865b4',
        },
    },
    'paow': {
        'takes': SEATS + [('deal_posdealer', 'deal/deal_posdealer/deal_posdealer.mp4', 'dealer', 'white'),
                          ('deal_pos6b', 'deal/deal_pos6/variant/deal_pos6b.mp4', '6', 'white')],
        'inputs': {
            'VILA.png': '7274b6858430119e80149aa342efae4fd059dec3363eef1d5df19b77cbd9b2f4',
            'REDO.png': '3600248f74d4ed711ef3d23f86b9e0a1b0d4c1c7d010afa06e03ea02131e7217',
            'in_vila_till_redo.mp4': '0947b54aec4abd7bad2d20cce6d9543edb0bfb113977dabb72a8e765725005d8',
            'ut_redo_till_vila.mp4': '3aa239c2b0a53aef732c6a715cdf11cf0d9a5214faf1eae062c8bcdadda1e4b1',
            'deal_pos1.mp4': '8783bcb2b2db99a12b7e5ae22cb254b4fb5f30fd1939f9a864f28f9a86752250',
            'deal_pos2.mp4': 'f6937e191a8a6d297f0d015b416d8c5aa73081e63ddb9b88279fd83292cd5f12',
            'deal_pos3.mp4': 'c2ca9485efbd38a5ce6fc94220e7ec27b4b78fd4bfa3dfbf699eb2b7e8597408',
            'deal_pos4.mp4': 'c97020ec705a0383ed5d51a6bd76593b174f8d26f28339acbe7d4fd15431d4c4',
            'deal_pos5.mp4': '33767e0836f2e8838add167a1034ffd7d0d7e884913008ceea37a1221da9d95c',
            'deal_pos6.mp4': '9ea4ba914e660891253fe7eb975a87e282cf80084cc905078a07232f8b0b1928',
            'deal_pos6b.mp4': 'f2fb90e0e12b3c5e9789edf79be748788913945b387e85b25b1911ddf075792c',
            'deal_pos7.mp4': 'aac066b42a47417e510baffba07d23e102ebbcfdd367fe62bea5bdb3aacc6216',
            'deal_posdealer.mp4': '05e713bf61909ba49a711fa3e3b9e6dcabcd0b408812ac75dc48481cade4754e',
        },
    },
}
DECODE = 'scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24'
ENCODE = ['-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd,format=yuv420p',
          '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p',
          '-colorspace', 'bt709', '-color_range', 'tv', '-an', '-movflags', '+faststart']


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''): h.update(chunk)
    return h.hexdigest()


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', DECODE, '-f', 'rawvideo', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)


def encode(frames, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                          '-r', '24', '-i', '-', *ENCODE, path], stdin=subprocess.PIPE)
    for frame in frames: p.stdin.write(np.ascontiguousarray(frame).tobytes())
    p.stdin.close()
    if p.wait() != 0: sys.exit(f'ffmpeg failed: {path}')


def read_png(path):
    image = cv2.imread(path, cv2.IMREAD_COLOR)
    if image is None or image.shape != (H, W, 3): sys.exit(f'not a {W}x{H} image: {path}')
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def solid(c):
    return 1 - smoothstep(.03, .16, c[..., 1] - np.maximum(c[..., 0], c[..., 2]))


def key(rgb):
    """dealer-layer.js: alpha from a five-tap cross (centre .4, four taps 1.5 px away at .15, sampled
    bilinearly with clamped edges), then despill: g <= max(r, b) + .01 where solid, (r + b) / 2 where
    see-through. Returns despilled colour and alpha, both 0..1."""
    c = rgb.astype(np.float32) / 255
    p = np.pad(c, ((2, 2), (2, 2), (0, 0)), mode='edge')
    at = lambda dy, dx: p[2 + dy:2 + dy + H, 2 + dx:2 + dx + W]
    tap = lambda a, b: solid(.5 * (at(*a) + at(*b)))   # 1.5 px = halfway between the texels 1 and 2 px away
    a = .4 * solid(c) + .15 * (tap((0, 1), (0, 2)) + tap((0, -1), (0, -2)) + tap((1, 0), (2, 0)) + tap((-1, 0), (-2, 0)))
    w = smoothstep(.6, 1, a)
    c[..., 1] = np.minimum(c[..., 1], (c[..., 0] + c[..., 2]) * .5 * (1 - w) + (np.maximum(c[..., 0], c[..., 2]) + .01) * w)
    return c, a


def over(c, a, bg):
    return c * a[..., None] + bg * (1 - a[..., None])


def to8(x):
    return np.clip(np.round(x * 255), 0, 255).astype(np.uint8)


def landed_prop(c, a, seat, kind):
    """The landed card in the deal's last frame: its paper (white, neutral) or back (black) pixels at the
    seat, filled to the card's convex outline, widened 3 px for the soft keyed edge, minus skin (a
    fingertip touching the card stays with the dealer). Returns that region times the keyed alpha."""
    cx, cy = CENTRES[seat]
    x0, y0, x1, y1 = cx - 70, cy - 90, cx + 70, cy + 90
    box = c[y0:y1, x0:x1]
    lo, hi = box.min(axis=2), box.max(axis=2)
    face = (lo > .55) & (hi - lo < .15) if kind == 'white' else hi < .3
    n, lab, st, cen = cv2.connectedComponentsWithStats((face & (a[y0:y1, x0:x1] > .5)).astype(np.uint8))
    near = [k for k in range(1, n) if st[k, 4] > 2000 and abs(cen[k][0] + x0 - cx) < 20 and abs(cen[k][1] + y0 - cy) < 20]
    if len(near) != 1: sys.exit(f'no single card at seat {seat}')
    k = near[0]
    bx, by, bw, bh, area = st[k]
    if bx == 0 or by == 0 or bx + bw == x1 - x0 or by + bh == y1 - y0: sys.exit(f'card at seat {seat} runs into something else')
    hull = np.zeros(lab.shape, np.uint8)
    cv2.fillConvexPoly(hull, cv2.convexHull(cv2.findNonZero((lab == k).astype(np.uint8))), 1)
    r, g, b = box[..., 0], box[..., 1], box[..., 2]
    skin = (r > .2) & (g <= r) & (r - b > .06) & (g > .42 * r)          # dealer-layer.js' skin test
    region = (cv2.dilate(hull, np.ones((7, 7), np.uint8)) > 0) & ~skin
    prop = np.zeros((H, W), np.float32)
    prop[y0:y1, x0:x1] = a[y0:y1, x0:x1] * region
    hx, hy, hw, hh = cv2.boundingRect(hull)
    return prop, {'size': [int(hw), int(hh)], 'area': int(hull.sum()),
                  'centre': [round(float(cen[k][0]) + x0, 1), round(float(cen[k][1]) + y0, 1)]}


def card_box(seat, pad=0):
    cx, cy = CENTRES[seat]
    return slice(cy - CARD[1] // 2 - pad, cy + CARD[1] // 2 + pad + 1), slice(cx - CARD[0] // 2 - pad, cx + CARD[0] // 2 + pad + 1)


def psnr(a, b, mask=None):
    d = (a.astype(np.float64) - b.astype(np.float64)) ** 2
    m = d[mask].mean() if mask is not None else d.mean()
    return round(float(10 * np.log10(255 ** 2 / max(m, 1e-12))), 2)


def green_excess(rgb):
    x = rgb.astype(np.int16)
    return x[..., 1] - np.maximum(x[..., 0], x[..., 2])


def frame_count(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries',
                          'stream=nb_read_frames,codec_type', '-show_entries', 'format=nb_streams', '-of', 'json', path],
                         capture_output=True, text=True, check=True).stdout
    info = json.loads(out)
    return int(info['streams'][0]['nb_read_frames']), int(info['format']['nb_streams'])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dealer', required=True, choices=sorted(DEALERS))
    ap.add_argument('--delivery', required=True, help='the KLARA produktion/ directory')
    ap.add_argument('--out', required=True, help='new directory for bank/ and receipt.json')
    args = ap.parse_args()
    spec, src = DEALERS[args.dealer], os.path.abspath(args.delivery)
    if os.path.exists(args.out) and os.listdir(args.out): sys.exit('--out must be new or empty')
    bank = os.path.join(args.out, 'bank')
    os.makedirs(bank, exist_ok=True)
    cv2.setNumThreads(2)

    inputs = {}
    for name, expected in spec['inputs'].items():
        got = sha256(os.path.join(src, name))
        if got != expected: sys.exit(f'{name}: sha256 {got} is not the reviewed delivery')
        inputs[name] = {'sha256': got, 'size': os.path.getsize(os.path.join(src, name))}
    for name, expected in (PLATE, PLATE_SCRIPT):
        if sha256(os.path.join(HERE, name)) != expected: sys.exit(f'{name} changed')
    plate8 = read_png(os.path.join(HERE, PLATE[0]))
    plate = plate8.astype(np.float32) / 255
    plate_green = green_excess(plate8)

    c, a = key(read_png(os.path.join(src, 'VILA.png')))
    rest = to8(over(c, a, plate))
    cv2.imwrite(os.path.join(bank, 'rest.png'), cv2.cvtColor(rest, cv2.COLOR_RGB2BGR))
    cv2.imwrite(os.path.join(bank, 'poster.jpg'), cv2.cvtColor(rest[0:W], cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 90])

    IN, UT = decode(os.path.join(src, 'in_vila_till_redo.mp4')), decode(os.path.join(src, 'ut_redo_till_vila.mp4'))
    for name, frames in (('in_vila_till_redo.mp4', IN), ('ut_redo_till_vila.mp4', UT)): inputs[name]['frames'] = len(frames)
    films, clips = [], {}
    for take, path, seat, kind in spec['takes']:
        D = decode(os.path.join(src, take + '.mp4'))
        inputs[take + '.mp4']['frames'] = len(D)
        out = [to8(over(*key(f), plate)) for f in IN] + [to8(over(*key(f), plate)) for f in D[1:]]
        last_c, last_a = key(D[-1])
        prop, measured = landed_prop(last_c, last_a, seat, kind)
        under = over(last_c, prop, plate)                   # the plate with the landed card, under the dealer
        out += [to8(over(*key(f), under)) for f in UT[1:]]
        deal_end = len(IN) + len(D) - 2
        box = card_box(seat)
        # The card lies still from here. Measured against the frame before the deal's last one: that last
        # frame is the delivery's REDO + card still, whose card is a little warmer than the filmed one.
        settled = deal_end - 1
        while settled > 0 and np.abs(out[settled - 1][box].astype(int) - out[deal_end - 1][box].astype(int)).mean() <= 3: settled -= 1
        target = os.path.join(bank, path)
        encode(out, target)

        frames, streams = frame_count(target)
        back = decode(target)
        whole = np.ones((H, W), bool)
        outside = whole.copy(); outside[card_box(seat, pad=12)] = False
        inner = back[-1][card_box(seat, pad=-12)].astype(int)
        card_check = (inner.min(axis=2).mean() > 150) if kind == 'white' else (inner.max(axis=2).mean() < 70)
        fringe = max(int(((green_excess(f) > 20) & (plate_green < 10)).sum()) for f in back)
        film = {
            'path': path, 'take': take + '.mp4', 'seat': seat, 'card': kind,
            'join': {'in': len(IN), 'deal': len(D) - 1, 'ut': len(UT) - 1},
            'frames': frames, 'streams': streams,
            'cardSettledFromFrame': settled, 'dealEndsOnFrame': deal_end,
            'landedProp': measured,
            'checks': {
                'firstFrameVsRestPsnr': psnr(back[0], rest),
                'lastFrameVsRestOutsideCardPsnr': psnr(back[-1], rest, outside),
                'cardOnSeatInLastFrame': bool(card_check),
                'encodeVsCompositePsnr': [psnr(back[0], out[0]), psnr(back[-1], out[-1])],
                'greenFringePixelsMax': fringe,
            },
        }
        if frames != len(out) or streams != 1 or not card_check: sys.exit(f'{path} failed its checks: {film}')
        films.append(film)
        clips[path] = {'rutor': frames, 'plats': 'hål' if kind == 'black' else seat, 'kortet_ligger_still_fran_ruta': settled}
        print(path, json.dumps(film['checks']), 'frames', frames, 'settled', settled, 'prop', measured, flush=True)

    for take, path, seat, kind in spec['takes']:
        if '/variant/' not in path:
            keep = os.path.join(bank, os.path.dirname(path), 'variant', '.gitkeep')
            os.makedirs(os.path.dirname(keep), exist_ok=True); open(keep, 'w').close()
    positions = {'bild': f'{W}x{H}', 'kort_bredd': CARD[0], 'kort_hojd': CARD[1],
                 'positioner': {k: {'cx': x, 'cy': y} for k, (x, y) in CENTRES.items()}}
    if any(kind == 'black' for *_, kind in spec['takes']): positions['hålkort'] = 'samma plats som dealer (svart baksida upp)'
    positions.update({'startbild': 'rest.png', 'klipp': clips})
    with open(os.path.join(bank, 'kortpositioner.json'), 'w', encoding='utf-8') as f:
        json.dump(positions, f, indent=1, ensure_ascii=False); f.write('\n')

    outputs = {}
    for root, _, names in os.walk(bank):
        for name in sorted(names):
            full = os.path.join(root, name)
            outputs[os.path.relpath(full, bank).replace(os.sep, '/')] = {'sha256': sha256(full), 'size': os.path.getsize(full)}
    receipt = {
        'dealer': args.dealer, 'delivery': 'KLARA (MiniMax H3), produktion/, 2026-10-07',
        'inputs': inputs,
        'plate': {'file': PLATE[0], 'sha256': PLATE[1], 'builtBy': PLATE_SCRIPT[0], 'builtBySha256': PLATE_SCRIPT[1]},
        'buildScriptSha256': sha256(os.path.abspath(__file__)),
        'restStill': {'from': 'VILA.png', 'firstFilmFrameMatrix': 'bt709'},
        'encode': ' '.join(ENCODE), 'decode': DECODE,
        'tools': {'ffmpeg': subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True).stdout.split('\n')[0],
                  'python': platform.python_version(), 'numpy': np.__version__, 'opencv': cv2.__version__},
        'films': films, 'outputs': outputs,
    }
    with open(os.path.join(args.out, 'receipt.json'), 'w', encoding='utf-8') as f:
        json.dump(receipt, f, indent=1, ensure_ascii=False); f.write('\n')


if __name__ == '__main__':
    main()
