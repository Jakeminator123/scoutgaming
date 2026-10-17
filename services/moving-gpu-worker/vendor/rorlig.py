#!/usr/bin/env python3
"""Läppsynk på rörliga klipp (prototyp 2026-10-12) — MuseTalk 1.5 med samma recept som spelets arbetare
(astrid-gpu-worker, gren dragge-avatar), men med en avatar PER BILDRUTA i stället för en stillbild.

  forbered  klipp.mp4 …                 spårar ansiktet i varje ruta (MediaPipe i 2x), jämnar ut rutan över tid,
                                        och sparar per ruta: ansiktsruta, blandningsmask, VAE-latent och
                                        färgkorrektion (originalet − MuseTalks tysta mun, lågpassad)
  rendera   --klipp a.mp4 b.mp4 … --ljud x.wav --start N --ut ut.mp4
                                        lägger repliken över kedjan av klipp med start i ruta N; munnen blandas in
                                        i originalets yuv420p-plan (BT.709), så allt utanför munmasken är orört

Körs i mt-venv:  cd /workspace/MuseTalk && /workspace/mt-venv/bin/python /workspace/rorlig/rorlig.py …
"""
import argparse, json, os, subprocess, sys, tempfile, time, wave

os.chdir("/workspace/MuseTalk")
sys.path.insert(0, "/workspace/MuseTalk")
sys.path.insert(0, "/workspace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))     # preprocessing_mp bredvid

import cv2
import numpy as np
import torch

FFMPEG = "/usr/bin/ffmpeg"
FFPROBE = "/usr/bin/ffprobe"
FPS, SCALE, BATCH = 24, 2, 16
A = 2 * SCALE                       # munrutan på multiplar av 4 i 2x = jämna 1x-koordinater (yuv420-kroma)
PREP = os.environ.get("PREP", "/workspace/rorlig/prep")
# Samma efterbehandling som arbetaren (POLISH): tystnad runt repliken, mjuk in/ut-toning, färgkorrektion, skärpning
PAD_BEFORE_S, PAD_AFTER_S = 0.22, 0.53
PURE_IN, RAMP_IN, RAMP_OUT, PURE_OUT = 2, 3, 8, 1
BIAS_SIGMA, SHARP, SHARP_SIGMA = 8.0, 1.5, 1.0


def say(*a):
    print(*a, flush=True)


# ------------------------------------------------------------------ video och färg ---
def probe(path):
    r = subprocess.run([FFPROBE, "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height",
                        "-of", "csv=p=0", path], capture_output=True, text=True, check=True, stdin=subprocess.DEVNULL)
    w, h = map(int, r.stdout.strip().split(",")[:2])
    return w, h


def read_yuv(path):
    """alla rutor som råa yuv420p-plan, utan någon färgkonvertering → [(Y, U, V)]"""
    w, h = probe(path)
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "yuv420p", "-"],
                         capture_output=True, check=True, stdin=subprocess.DEVNULL).stdout
    fs = w * h * 3 // 2
    n = len(raw) // fs
    buf = np.frombuffer(raw, np.uint8)[:n * fs].reshape(n, fs)
    out = []
    for f in buf:
        Y = f[:w * h].reshape(h, w)
        U = f[w * h:w * h + w * h // 4].reshape(h // 2, w // 2)
        V = f[w * h + w * h // 4:].reshape(h // 2, w // 2)
        out.append((Y, U, V))
    return out, w, h


def yuv_to_bgr(Y, U, V):
    """BT.709 tv-range → BGR float (0–255). U/V har halva upplösningen."""
    h, w = Y.shape
    y = (Y.astype(np.float32) - 16.0) * (255.0 / 219.0)
    u = cv2.resize(U, (w, h), interpolation=cv2.INTER_LINEAR).astype(np.float32) - 128.0
    v = cv2.resize(V, (w, h), interpolation=cv2.INTER_LINEAR).astype(np.float32) - 128.0
    u *= 255.0 / 224.0
    v *= 255.0 / 224.0
    r = y + 1.5748 * v
    g = y - 0.187324 * u - 0.468124 * v
    b = y + 1.8556 * u
    return np.dstack([b, g, r])


def bgr_to_yuv(bgr):
    """BGR float → (Y full, U halv, V halv) som float, BT.709 tv-range; kroman som 2×2-medel"""
    b, g, r = bgr[..., 0], bgr[..., 1], bgr[..., 2]
    yl = 0.2126 * r + 0.7152 * g + 0.0722 * b
    Y = 16.0 + yl * (219.0 / 255.0)
    U = 128.0 + (b - yl) / 1.8556 * (224.0 / 255.0)
    V = 128.0 + (r - yl) / 1.5748 * (224.0 / 255.0)
    h, w = Y.shape
    U = U.reshape(h // 2, 2, w // 2, 2).mean((1, 3))
    V = V.reshape(h // 2, 2, w // 2, 2).mean((1, 3))
    return Y, U, V


def region2x_of(frame, xs, ys, xe, ye):
    """munrutan i 2x (xs..ye är 2x-koordinater) — ett 1x-fönster med 4 px marginal skalas upp och trimmas,
    vilket ger samma pixlar som att skala upp hela bilden (Lanczos når 4 px)"""
    Y, U, V = frame
    h, w = Y.shape
    X0, Y0, X1, Y1 = xs // 2, ys // 2, xe // 2, ye // 2
    p = 4
    wx0, wy0, wx1, wy1 = max(X0 - p, 0), max(Y0 - p, 0), min(X1 + p, w), min(Y1 + p, h)
    bgr = yuv_to_bgr(Y[wy0:wy1, wx0:wx1], U[wy0 // 2:wy1 // 2, wx0 // 2:wx1 // 2], V[wy0 // 2:wy1 // 2, wx0 // 2:wx1 // 2])
    up = cv2.resize(np.clip(bgr, 0, 255), ((wx1 - wx0) * 2, (wy1 - wy0) * 2), interpolation=cv2.INTER_LANCZOS4)
    ox, oy = (X0 - wx0) * 2, (Y0 - wy0) * 2
    return up[oy:oy + (ye - ys), ox:ox + (xe - xs)], bgr[Y0 - wy0:Y1 - wy0, X0 - wx0:X1 - wx0]


# ------------------------------------------------------------------ modeller ---
_M = {}


def models():
    if _M:
        return _M
    from transformers import WhisperModel
    from musetalk.utils.utils import load_all_model
    from musetalk.utils.audio_processor import AudioProcessor
    device = torch.device("cuda:0")
    vae, unet, pe = load_all_model(unet_model_path="./models/musetalkV15/unet.pth", vae_type="sd-vae",
                                   unet_config="./models/musetalkV15/musetalk.json", device=device)
    pe = pe.half().to(device)
    vae.vae = vae.vae.half().to(device)
    unet.model = unet.model.half().to(device)
    wd = unet.model.dtype
    ap = AudioProcessor(feature_extractor_path="./models/whisper")
    wh = WhisperModel.from_pretrained("./models/whisper").to(device=device, dtype=wd).eval()
    wh.requires_grad_(False)
    _M.update(device=device, vae=vae, unet=unet, pe=pe, wd=wd, ap=ap, whisper=wh,
              t=torch.tensor([0], device=device))
    return _M


@torch.no_grad()
def latent_of(crop256):
    """MuseTalks get_latents_for_unet men med fördelningens MEDEL i stället för ett slumpdrag — en latent per ruta
    med eget brus skulle ge flimmer mellan rutorna (stillbilden hade bara en)."""
    vae = models()["vae"]
    out = []
    for half in (True, False):
        x = vae.preprocess_img(crop256, half_mask=half)
        out.append(vae.scaling_factor * vae.vae.encode(x.to(vae.vae.dtype)).latent_dist.mean)
    return torch.cat(out, dim=1)


@torch.no_grad()
def whisper_chunks(pcm16k):
    m = models()
    feats = []
    for i in range(0, max(len(pcm16k), 1), 30 * 16000):
        f = m["ap"].feature_extractor(pcm16k[i:i + 30 * 16000], return_tensors="pt", sampling_rate=16000).input_features
        feats.append(f.to(dtype=m["wd"]))
    return m["ap"].get_whisper_chunk(feats, m["device"], m["wd"], m["whisper"], len(pcm16k), fps=FPS,
                                     audio_padding_length_left=2, audio_padding_length_right=2)


@torch.no_grad()
def generate(latents, chunks):
    """latents (n,8,32,32) och whisper-bitar (n,…) parvis → n ansikten 256×256 BGR uint8"""
    m = models()
    for i in range(0, len(chunks), BATCH):
        wb, lb = chunks[i:i + BATCH], latents[i:i + BATCH]
        n = wb.shape[0]
        if n < BATCH:
            wb = torch.cat([wb, wb[-1:].repeat(BATCH - n, 1, 1)], dim=0)
            lb = torch.cat([lb, lb[-1:].repeat(BATCH - n, 1, 1, 1)], dim=0)
        feat = m["pe"](wb.to(m["device"]))
        pred = m["unet"].model(lb.to(m["device"], m["wd"]), m["t"], encoder_hidden_states=feat).sample
        for face in m["vae"].decode_latents(pred.to(dtype=m["vae"].vae.dtype))[:n]:
            yield face


def load_audio(wav_in):
    import librosa
    with wave.open(wav_in, "rb") as wv:
        rate, nch, sw = wv.getframerate(), wv.getnchannels(), wv.getsampwidth()
        raw = wv.readframes(wv.getnframes())
    assert sw == 2, "16-bit PCM förväntas"
    y = np.frombuffer(raw, dtype=np.int16).reshape(-1, nch).mean(1).astype(np.float32) / 32768.0
    y = np.concatenate([np.zeros(int(PAD_BEFORE_S * rate), np.float32), y, np.zeros(int(PAD_AFTER_S * rate), np.float32)])
    y16 = librosa.resample(y, orig_sr=rate, target_sr=16000) if rate != 16000 else y
    return y, rate, whisper_chunks(y16)[:int(np.floor(len(y) / rate * FPS))]


# ------------------------------------------------------------------ förbered ---
def smooth(a, sigma):
    """gaussisk utjämning längs tiden, kanterna hålls (klippen börjar och slutar i stillbilden)"""
    if sigma <= 0 or len(a) < 3:
        return a.astype(np.float64)
    r = int(np.ceil(3 * sigma))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    pad = np.concatenate([np.repeat(a[:1], r, 0), a, np.repeat(a[-1:], r, 0)])
    return np.stack([np.convolve(pad[:, j], k, mode="valid") for j in range(a.shape[1])], 1)


def pose(lm):
    """grova mått i 2x: lutning (haka−näsa)/(näsa−bryn), vridning (näsans läge i ansiktets bredd), munöppning"""
    fw = float(lm[16, 0] - lm[0, 0])
    nose = lm[30]
    brow = lm[17:27, 1].mean()
    pitch = float((lm[8, 1] - nose[1]) / max(nose[1] - brow, 1e-3))
    yaw = float((nose[0] - (lm[0, 0] + lm[16, 0]) / 2) / max(fw, 1e-3))
    mouth = float((lm[66, 1] - lm[62, 1]) / max(fw, 1e-3))
    return pitch, yaw, mouth, fw


def forbered(clip, sigma, cheek, out=None, segs=None, bias_skala=4):
    from preprocessing_mp import landmarks68, bbox_from_landmarks
    from musetalk.utils.blending import get_image_prepare_material
    from musetalk.utils.face_parsing import FaceParsing
    name = os.path.splitext(os.path.basename(clip))[0]
    dealer = os.path.basename(os.path.dirname(os.path.abspath(clip)))
    out = out or f"{PREP}/{dealer}/{name}"
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    frames, w, h = read_yuv(clip)
    n = len(frames)
    raw, poses, found = [], [], []
    for Y, U, V in frames:
        big = cv2.resize(np.clip(yuv_to_bgr(Y, U, V), 0, 255).astype(np.uint8), (w * SCALE, h * SCALE),
                         interpolation=cv2.INTER_LANCZOS4)
        lm = landmarks68(big)
        if lm is None:
            raw.append(raw[-1] if raw else [0, 0, 0, 0]); poses.append(poses[-1] if poses else (0, 0, 0, 0)); found.append(False)
            continue
        x1, y1, x2, y2 = bbox_from_landmarks(lm, big.shape[0], 0)
        raw.append([x1, y1, x2, min(y2 + 10, big.shape[0])])     # extra_margin 10 = MuseTalk v15
        poses.append(pose(lm)); found.append(True)
    t_lm = time.time() - t0
    raw = np.array(raw, np.float64)
    # rutans mitt och storlek utjämnas var för sig; storleken hårdare (skalhopp syns mer än små förflyttningar)
    c = np.stack([(raw[:, 0] + raw[:, 2]) / 2, (raw[:, 1] + raw[:, 3]) / 2], 1)
    s = np.stack([raw[:, 2] - raw[:, 0], raw[:, 3] - raw[:, 1]], 1)
    # segs = längderna på källsegmenten (paketets rutpool): utjämningen får inte blanda rutor från olika klipp
    cuts = np.cumsum([0] + list(segs or [len(c)]))
    assert cuts[-1] == len(c), f"segmenten ({cuts[-1]}) ≠ rutorna ({len(c)})"
    c = np.concatenate([smooth(c[a:b], sigma) for a, b in zip(cuts[:-1], cuts[1:])])
    s = np.concatenate([smooth(s[a:b], sigma * 2) for a, b in zip(cuts[:-1], cuts[1:])])
    boxes = np.round(np.concatenate([c - s / 2, c + s / 2], 1)).astype(int)

    fp = FaceParsing(left_cheek_width=cheek, right_cheek_width=cheek)
    lat, meta, masks, origs, reg2x = [], [], {}, [], []
    for i, (Y, U, V) in enumerate(frames):
        x1, y1, x2, y2 = [int(v) for v in boxes[i]]
        # bara ett fönster runt ansiktet skalas upp — samma pixlar som helbilden i 2x
        mx = (x2 - x1)
        wx0, wy0 = max((x1 - mx) // A * A, 0), max((y1 - mx) // A * A, 0)
        wx1, wy1 = min((x2 + mx) // A * A, w * SCALE), min((y2 + mx) // A * A, h * SCALE)
        win, _ = region2x_of((Y, U, V), wx0, wy0, wx1, wy1)
        win = np.clip(win, 0, 255).astype(np.uint8)
        crop = win[y1 - wy0:y2 - wy0, x1 - wx0:x2 - wx0]
        lat.append(latent_of(cv2.resize(crop, (256, 256), interpolation=cv2.INTER_LANCZOS4)).cpu())
        mask, cb = get_image_prepare_material(win, [x1 - wx0, y1 - wy0, x2 - wx0, y2 - wy0], fp=fp, mode="jaw")
        cx1, cy1, cx2, cy2 = cb[0] + wx0, cb[1] + wy0, cb[2] + wx0, cb[3] + wy0
        xs, ys = max(cx1, 0), max(cy1, 0)
        xe, ye = min(cx2, w * SCALE), min(cy2, h * SCALE)
        xs += (-xs) % A; ys += (-ys) % A
        xe -= xe % A; ye -= ye % A
        mf = mask[ys - cy1:ye - cy1, xs - cx1:xe - cx1].astype(np.float32) / 255.0
        RW, RH = (xe - xs) // SCALE, (ye - ys) // SCALE
        masks[f"m{i}"] = (cv2.resize(mf, (RW, RH), interpolation=cv2.INTER_AREA) * 255).round().astype(np.uint8)
        r2, o1 = region2x_of((Y, U, V), xs, ys, xe, ye)
        reg2x.append(r2); origs.append(o1)
        p = poses[i]
        meta.append({"bbox": [x1, y1, x2, y2], "region": [int(xs), int(ys), int(xe), int(ye)], "found": found[i],
                     "pitch": round(p[0], 3), "yaw": round(p[1], 3), "mouth": round(p[2], 4), "face_w": round(p[3], 1)})
    lat = torch.cat(lat, 0).half()
    t_prep = time.time() - t0 - t_lm

    # färgkorrektion per ruta: originalet − MuseTalks mun på tystnad, lågpassad (som arbetarens build_bias)
    sil = whisper_chunks(np.zeros(16000 * 3, np.float32))
    mid = sil[len(sil) // 2:len(sil) // 2 + 1].repeat(n, 1, 1)
    bias = {}
    for i, face in enumerate(generate(lat, mid)):
        small = paste_small(face, meta[i], reg2x[i])
        b = cv2.GaussianBlur(origs[i] - small, (0, 0), BIAS_SIGMA)
        # kartan är lågpassad (σ 8 px), så den sparas nedskalad bias_skala gånger och skalas upp vid läsning
        if bias_skala > 1:
            b = cv2.resize(b, (max(b.shape[1] // bias_skala, 1), max(b.shape[0] // bias_skala, 1)), interpolation=cv2.INTER_AREA)
        bias[f"b{i}"] = b.astype(np.float16)
    torch.save(lat, f"{out}/latents.pt")
    np.savez_compressed(f"{out}/masks.npz", **masks)
    np.savez_compressed(f"{out}/bias.npz", **bias)
    json.dump({"clip": os.path.abspath(clip), "frames": n, "size": [w, h], "sigma": sigma, "cheek": cheek, "bias_skala": bias_skala,
               "missing": int(n - sum(found)), "per_frame": meta}, open(f"{out}/meta.json", "w"))
    say(json.dumps({"klipp": f"{dealer}/{name}", "rutor": n, "utan_ansikte": int(n - sum(found)),
                    "s_landmarken": round(t_lm, 1), "s_latent_mask": round(t_prep, 1), "s_totalt": round(time.time() - t0, 1)}))


def paste_small(face256, m, region2x):
    """genererat ansikte → munrutan i 1x (float BGR), före färgkorrektion och alfa"""
    x1, y1, x2, y2 = m["bbox"]
    xs, ys, xe, ye = m["region"]
    face = cv2.resize(face256.astype(np.uint8), (x2 - x1, y2 - y1), interpolation=cv2.INTER_LINEAR)
    reg = region2x.copy()
    reg[y1 - ys:y2 - ys, x1 - xs:x2 - xs] = face
    return cv2.resize(reg, ((xe - xs) // SCALE, (ye - ys) // SCALE), interpolation=cv2.INTER_AREA)


# ------------------------------------------------------------------ rendera ---
def finputs(faces, forskjut=0, jamna=0.0):
    """efterbehandling av de genererade ansiktena (256×256, i ansiktsrutans koordinater — de följer huvudet):
    forskjut n = ruta k visar ansiktet för ljudet i k+n (munnen före ljudet, n=1 ≈ 42 ms);
    jamna w = varje ansikte blandas med grannarnas medel (vikt w) mot ryck mellan rutorna"""
    n = len(faces)
    if forskjut:
        faces = [faces[min(max(k + forskjut, 0), n - 1)] for k in range(n)]
    if jamna > 0 and n > 2:
        f = [x.astype(np.float32) for x in faces]
        faces = [np.clip((1 - jamna) * f[k] + jamna * 0.5 * (f[max(k - 1, 0)] + f[min(k + 1, n - 1)]), 0, 255)
                 for k in range(n)]
    return faces


def talvikt(y, rate, total, marg=5, ton=4):
    """0–1 per ruta: 1 där repliken låter (±marg rutor), mjukt ned till 0 i pauser — där visas klippets egen mun
    i stället för MuseTalks 'tysta' mun. Tröskel relativt replikens starkaste ruta (−35 dB)."""
    hop = rate / FPS
    rms = np.array([np.sqrt(np.mean(y[int(k * hop):int((k + 1) * hop)] ** 2) + 1e-12) for k in range(total)])
    db = 20 * np.log10(rms)
    on = db > db.max() - 35
    if marg:
        on = np.convolve(on.astype(float), np.ones(2 * marg + 1), "same") > 0
    k = np.ones(2 * ton + 1) / (2 * ton + 1)
    return np.clip(np.convolve(np.pad(on.astype(float), ton, mode="edge"), k, "valid"), 0, 1)


def ramp(i, n):
    if i < PURE_IN or i >= n - PURE_OUT:
        return 0.0
    if i < PURE_IN + RAMP_IN:
        return (i - PURE_IN + 1) / (RAMP_IN + 1)
    if i >= n - PURE_OUT - RAMP_OUT:
        t = (n - PURE_OUT - i) / (RAMP_OUT + 1)
        return t * t * (3 - 2 * t)
    return 1.0


def load_prep(clip=None, d=None):
    """förberedelsen för ett klipp (provskriptens mappar) eller en given mapp (paketets rutpool);
    färgkorrektionen skalas upp till munrutans storlek om den sparats nedskalad"""
    if d is None:
        name = os.path.splitext(os.path.basename(clip))[0]
        dealer = os.path.basename(os.path.dirname(os.path.abspath(clip)))
        d = f"{PREP}/{dealer}/{name}"
    meta = json.load(open(f"{d}/meta.json"))
    pf = meta["per_frame"]
    raw = np.load(f"{d}/bias.npz")

    class Bias:
        def __getitem__(self, key):
            b = raw[key]
            if meta.get("bias_skala", 1) > 1:
                xs, ys, xe, ye = pf[int(key[1:])]["region"]
                b = cv2.resize(b.astype(np.float32), ((xe - xs) // SCALE, (ye - ys) // SCALE), interpolation=cv2.INTER_LINEAR)
            return b

    return {"meta": pf, "lat": torch.load(f"{d}/latents.pt"), "mask": np.load(f"{d}/masks.npz"), "bias": Bias()}


def encoder(path, w, h, crf):
    return subprocess.Popen([FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "yuv420p", "-s", f"{w}x{h}",
                             "-r", str(FPS), "-color_range", "tv", "-colorspace", "bt709", "-i", "-",
                             "-c:v", "libx264", "-preset", "medium", "-crf", str(crf), "-pix_fmt", "yuv420p",
                             "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
                             path], stdin=subprocess.PIPE, stderr=subprocess.PIPE)


def rendera(a):
    t0 = time.time()
    seq, preps, frames = [], [], []
    for ci, clip in enumerate(a.klipp):
        fr, w, h = read_yuv(clip)
        frames.append(fr); preps.append(load_prep(clip))
        seq += [(ci, fi) for fi in range(len(fr))]
    m = models()
    t_load = time.time() - t0; t = time.time()
    y, rate, chunks = load_audio(a.ljud)
    total = len(chunks)
    start = a.start
    assert start + total <= len(seq), f"repliken ({total} rutor) räcker längre än klippen ({len(seq) - start} rutor efter start)"
    lat = torch.stack([preps[ci]["lat"][fi] for ci, fi in seq[start:start + total]])
    t_wh = time.time() - t; t = time.time()
    faces = list(generate(lat, chunks))
    t_gen = time.time() - t; t = time.time()
    faces = finputs(faces, a.forskjut, a.jamna)
    TV = talvikt(y, rate, total) if a.pauser else np.ones(total)

    tmp = tempfile.mkdtemp(prefix="rorlig_")
    vid = os.path.join(tmp, "v.mp4")
    ff = encoder(vid, w, h, a.crf)
    ffo = encoder(os.path.join(tmp, "orig.mp4"), w, h, a.crf) if a.jamfor else None
    t_comp = 0.0
    for g, (ci, fi) in enumerate(seq):
        Y, U, V = frames[ci][fi]
        if ffo:
            ffo.stdin.write(Y.tobytes() + U.tobytes() + V.tobytes())
        k = g - start
        if 0 <= k < total and ramp(k, total) * TV[k] > 0:
            tc = time.time()
            P = preps[ci]
            mm = P["meta"][fi]
            xs, ys, xe, ye = mm["region"]
            r2, o1 = region2x_of((Y, U, V), xs, ys, xe, ye)
            small = paste_small(faces[k], mm, r2)
            small = small + P["bias"][f"b{fi}"].astype(np.float32)
            small = small + a.skarpa * (small - cv2.GaussianBlur(small, (0, 0), SHARP_SIGMA))
            alpha = P["mask"][f"m{fi}"].astype(np.float32) / 255.0 * ramp(k, total) * TV[k] * a.styrka
            Yn, Un, Vn = bgr_to_yuv(np.clip(small, 0, 255))
            X0, Y0, X1, Y1 = xs // 2, ys // 2, xe // 2, ye // 2
            Y, U, V = Y.copy(), U.copy(), V.copy()
            Y[Y0:Y1, X0:X1] = np.clip(np.round(alpha * Yn + (1 - alpha) * Y[Y0:Y1, X0:X1]), 0, 255)
            a2 = alpha.reshape(alpha.shape[0] // 2, 2, alpha.shape[1] // 2, 2).mean((1, 3))
            U[Y0 // 2:Y1 // 2, X0 // 2:X1 // 2] = np.clip(np.round(a2 * Un + (1 - a2) * U[Y0 // 2:Y1 // 2, X0 // 2:X1 // 2]), 0, 255)
            V[Y0 // 2:Y1 // 2, X0 // 2:X1 // 2] = np.clip(np.round(a2 * Vn + (1 - a2) * V[Y0 // 2:Y1 // 2, X0 // 2:X1 // 2]), 0, 255)
            t_comp += time.time() - tc
        ff.stdin.write(Y.tobytes() + U.tobytes() + V.tobytes())
    for p in (ff, ffo):
        if p:
            p.stdin.close(); err = p.stderr.read().decode(errors="replace")
            assert p.wait() == 0, err[-500:]
    t_enc = time.time() - t

    # ljudet: repliken (med sin tystnad runt) läggs in med start i ruta `start`
    wavp = os.path.join(tmp, "a.wav")
    lead = np.zeros(int(round(start / FPS * rate)), np.float32)
    tail = np.zeros(max(int(len(seq) / FPS * rate) - len(lead) - len(y), 0), np.float32)
    with wave.open(wavp, "wb") as wv:
        wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(rate)
        wv.writeframes((np.clip(np.concatenate([lead, y, tail]), -1, 1) * 32767).astype(np.int16).tobytes())
    os.makedirs(os.path.dirname(os.path.abspath(a.ut)), exist_ok=True)
    subprocess.run([FFMPEG, "-y", "-v", "error", "-i", vid, "-i", wavp, "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
                    "-shortest", "-movflags", "+faststart", a.ut], check=True)
    if a.jamfor:
        # sida vid sida: original | läppsynk, och under dem ansiktet förstorat 2x (medelrutan under repliken)
        bb = np.array([preps[ci]["meta"][fi]["bbox"] for ci, fi in seq[start:start + total]]) / SCALE
        cx, cy = int(np.median((bb[:, 0] + bb[:, 2]) / 2)), int(np.median((bb[:, 1] + bb[:, 3]) / 2))
        S = 300
        x0, y0 = max(cx - S // 2, 0), max(cy - S // 2 + 30, 0)
        fc = (f"[0:v]split[o1][o2];[1:v]split[l1][l2];[o1]scale=540:960[ot];[l1]scale=540:960[lt];"
              f"[o2]crop={S}:{S}:{x0}:{y0},scale=540:540:flags=lanczos[ob];[l2]crop={S}:{S}:{x0}:{y0},scale=540:540:flags=lanczos[lb];"
              f"[ot][lt]hstack[top];[ob][lb]hstack[bot];[top][bot]vstack[v]")
        jam = a.ut[:-4] + "_jamfor.mp4"
        subprocess.run([FFMPEG, "-y", "-v", "error", "-i", os.path.join(tmp, "orig.mp4"), "-i", a.ut, "-filter_complex", fc,
                        "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
                        "-c:a", "copy", "-movflags", "+faststart", jam], check=True)
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)
    say(json.dumps({"ut": a.ut, "rutor": len(seq), "repliken_rutor": total, "start": start,
                    "s_ladda": round(t_load, 1), "s_whisper": round(t_wh, 2), "s_gpu": round(t_gen, 2),
                    "s_blandning": round(t_comp, 2), "s_kodning_inkl": round(t_enc, 1),
                    "gpu_rutor_per_s": round(total / max(t_gen, 1e-6), 1)}))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("forbered")
    f.add_argument("klipp", nargs="+")
    f.add_argument("--sigma", type=float, default=1.0, help="tidsutjämning av ansiktsrutan (rutor)")
    f.add_argument("--cheek", type=int, default=90)
    r = sub.add_parser("rendera")
    r.add_argument("--klipp", nargs="+", required=True)
    r.add_argument("--ljud", required=True)
    r.add_argument("--start", type=int, default=6)
    r.add_argument("--ut", required=True)
    r.add_argument("--crf", type=int, default=16)
    r.add_argument("--styrka", type=float, default=1.0)
    r.add_argument("--jamfor", action="store_true")
    r.add_argument("--pauser", type=int, default=1, help="1 = tona ut munnen i pauser (klippets egen mun)")
    r.add_argument("--forskjut", type=int, default=0, help="munnen n rutor före ljudet")
    r.add_argument("--jamna", type=float, default=0.3, help="tidsutjämning av munnen (0–0,5); 0,3 = recept B, Emils val 2026-10-12")
    r.add_argument("--skarpa", type=float, default=SHARP, help="oskarp mask, styrka (arbetaren: 1,5)")
    a = ap.parse_args()
    if a.cmd == "forbered":
        for c in a.klipp:
            forbered(c, a.sigma, a.cheek)
    else:
        rendera(a)
