#!/usr/bin/env python3
"""Persistent läppsynkmotor (MuseTalk 1.5) för Astrid-arbetaren — samma kedja och färgrecept som
demopodden: avataren är stillbilden i 2x, det genererade ansiktet blandas i munmaskens ruta och
läggs som BGRA-overlay på basens ORÖRDA yuv420p-plan (BT.709). Utanför munnen är varje bildruta
byte-identisk med stillbilden.

Protokoll (JSON-rader): in {"wav": <sökväg>, "out": <sökväg .mp4>, "crf"?, "preset"?}
                           {"session": {"url": "wss://…/lipsync-worker", "token": "…", "ttl": 540}}
                        ut {"ok": true, "frames": n} | {"ok": false, "error": "..."}
Vid start byggs avataren om den saknas (normalt är den bakad i imagen), sedan {"ready": true}.
Körs i mt-venv:  /workspace/mt-venv/bin/python /workspace/workers/lipsync_worker.py
"""
import glob, json, os, pickle, queue, subprocess, sys, tempfile, threading, time, wave

os.chdir("/workspace/MuseTalk")
sys.path.insert(0, "/workspace/MuseTalk")

import cv2
import librosa
import numpy as np
import torch
from transformers import WhisperModel
from musetalk.utils.utils import load_all_model
from musetalk.utils.audio_processor import AudioProcessor

AVATAR = os.environ.get("AVATAR_ID", "astrid_talk2x")
# Varje avatar har sin stillbild i assets/<AVATAR_ID>/; demots ursprungliga (astrid_talk2x) ligger direkt i assets/
_ADIR = f"/workspace/avatar/{AVATAR}" if os.path.isdir(f"/workspace/avatar/{AVATAR}") else "/workspace/avatar"
BASE_PNG = f"{_ADIR}/talk_base.png"
BASE_YUV = f"{_ADIR}/talk_base.yuv"
FPS = 24
BATCH = 16
# Efterbehandlingen (metodiken, v2 2026-09-24): POLISH=0 stänger av den för A/B.
#  - 0,35 s extra tystnad efter talet (0,18 + 0,35) så MuseTalk hinner stänga munnen själv,
#    och 8 rutors mjuk (smoothstep) övertoning tillbaka till stillbilden — slutet ryckte förut
#  - färgkorrektion: stillbilden − MuseTalks tysta mun, lågpassad σ 8 (byggs vid start, build_bias)
#  - skärpning: oskarp mask 1,5 / 1 px — råa läppar hade 1/3 av stillbildens skärpa
POLISH = os.environ.get("POLISH", "1") != "0"
PAD_BEFORE_S, PAD_AFTER_S = 0.22, (0.53 if POLISH else 0.18)
PURE_IN, RAMP_IN, RAMP_OUT, PURE_OUT = 2, 3, (8 if POLISH else 3), 1
BIAS_SIGMA, SHARP, SHARP_SIGMA = 8.0, 1.5, 1.0
# apt-ffmpeg, INTE conda-basens (/opt/conda/bin/ffmpeg saknar libx264 och kanner inte ens till -preset)
FFMPEG = "/usr/bin/ffmpeg"

def say(**kw):
    print(json.dumps(kw), flush=True)

base_dir = f"./results/v15/avatars/{AVATAR}"
if not os.path.exists(os.path.join(base_dir, "latents.pt")):
    say(status=f"bygger avatar {AVATAR}")
    r = subprocess.run([sys.executable, "/workspace/workers/prepare_avatar.py",
                        "--image", BASE_PNG, "--id", AVATAR, "--scale", "2"], capture_output=True, text=True)
    if r.returncode != 0:
        say(ok=False, error="prepare_avatar: " + r.stderr[-800:]); sys.exit(1)

say(status="laddar modeller")
device = torch.device("cuda:0")
vae, unet, pe = load_all_model(unet_model_path="./models/musetalkV15/unet.pth", vae_type="sd-vae",
                               unet_config="./models/musetalkV15/musetalk.json", device=device)
timesteps = torch.tensor([0], device=device)
pe = pe.half().to(device)
vae.vae = vae.vae.half().to(device)
unet.model = unet.model.half().to(device)
weight_dtype = unet.model.dtype
audio_processor = AudioProcessor(feature_extractor_path="./models/whisper")
whisper = WhisperModel.from_pretrained("./models/whisper").to(device=device, dtype=weight_dtype).eval()
whisper.requires_grad_(False)

info = json.load(open(os.path.join(base_dir, "avator_info.json")))
SCALE = int(info.get("scale", 2))
latent = torch.load(os.path.join(base_dir, "latents.pt"))[0].to(device=device, dtype=weight_dtype)
bbox = [int(v) for v in pickle.load(open(os.path.join(base_dir, "coords.pkl"), "rb"))[0]]
crop_box = [int(v) for v in pickle.load(open(os.path.join(base_dir, "mask_coords.pkl"), "rb"))[0]]
big = cv2.imread(sorted(glob.glob(os.path.join(base_dir, "full_imgs", "*.png")))[0])
mask = cv2.imread(sorted(glob.glob(os.path.join(base_dir, "mask", "*.png")))[0], cv2.IMREAD_GRAYSCALE)
anchor = cv2.imread(BASE_PNG)
H, W = anchor.shape[:2]
_yuv_bytes = os.path.getsize(BASE_YUV)
assert _yuv_bytes == W * H * 3 // 2, f"talk_base.yuv är {_yuv_bytes} byte, förväntade {W*H*3//2} för {W}x{H} yuv420p"
assert big.shape[0] == H * SCALE and big.shape[1] == W * SCALE, "avataren är inte basen i 2x"

cx1, cy1, cx2, cy2 = crop_box
# Rutan som klistras in måste ligga på jämna 2x-pixlar OCH ge jämna 1x-koordinater (yuv420-kroma),
# alltså multiplar av 2*SCALE. Avrunda start UPPÅT och slut NEDÅT så rutan hamnar INUTI maskens
# ruta — avrundas start nedåt (som förr) hamnar den utanför för vissa ansikten, maskutsnittet blir
# tomt och motorn dör vid start (hände med Astrid 2026-09-22; JEP-avataren råkade ligga rätt).
A = 2 * SCALE
xs, ys = max(cx1, 0), max(cy1, 0)
xe, ye = min(cx2, big.shape[1]), min(cy2, big.shape[0])
xs += (-xs) % A; ys += (-ys) % A
xe -= xe % A; ye -= ye % A
assert xs >= cx1 and ys >= cy1 and xe <= cx2 and ye <= cy2 and xe > xs and ye > ys, f"munrutan {crop_box} → {(xs, ys, xe, ye)}"
region2x = big[ys:ye, xs:xe].astype(np.float32)
mask_f = (mask[ys - cy1:ye - cy1, xs - cx1:xe - cx1].astype(np.float32) / 255.0)[..., None]
assert mask_f.shape[0] == ye - ys and mask_f.shape[1] == xe - xs, f"maskutsnitt {mask_f.shape[:2]} ≠ ruta {(ye - ys, xe - xs)}"
fx1, fy1, fx2, fy2 = bbox
rx1, ry1, rx2, ry2 = fx1 - xs, fy1 - ys, fx2 - xs, fy2 - ys
R1X = (xs // SCALE, ys // SCALE, xe // SCALE, ye // SCALE)
RW, RH = R1X[2] - R1X[0], R1X[3] - R1X[1]
mask1x = cv2.resize(mask_f[..., 0], (RW, RH), interpolation=cv2.INTER_AREA)
LATENT_BATCH = latent.repeat(BATCH, 1, 1, 1)


base1x = anchor[R1X[1]:R1X[3], R1X[0]:R1X[2]].astype(np.float32)
BIAS = None   # färgkorrektionskartan (1x, BGR) — byggs av build_bias() efter att modellerna laddats


def small_region(face256):
    """Genererat ansikte → munregionen i 1x (float BGR), före efterbehandling och alfa."""
    face = cv2.resize(face256.astype(np.uint8), (fx2 - fx1, fy2 - fy1), interpolation=cv2.INTER_LINEAR)
    reg = region2x.copy()
    reg[ry1:ry2, rx1:rx2] = face
    return cv2.resize(reg, (RW, RH), interpolation=cv2.INTER_AREA)


def compose_crop(face256, alpha_scale):
    small = small_region(face256)
    if POLISH and BIAS is not None:
        small = small + BIAS
        small = small + SHARP * (small - cv2.GaussianBlur(small, (0, 0), SHARP_SIGMA))
    a = np.clip(mask1x * alpha_scale, 0, 1)
    return np.ascontiguousarray(np.dstack([np.clip(small, 0, 255).astype(np.uint8), (a * 255).round().astype(np.uint8)]))


def ramp(i, n):
    if i < PURE_IN or i >= n - PURE_OUT:
        return 0.0
    if i < PURE_IN + RAMP_IN:
        return (i - PURE_IN + 1) / (RAMP_IN + 1)
    if i >= n - PURE_OUT - RAMP_OUT:
        t = (n - PURE_OUT - i) / (RAMP_OUT + 1)
        return t * t * (3 - 2 * t) if POLISH else t
    return 1.0


@torch.no_grad()
def whisper_chunks(pcm16k):
    seg_len = 30 * 16000
    feats = []
    for i in range(0, max(len(pcm16k), 1), seg_len):
        f = audio_processor.feature_extractor(pcm16k[i:i + seg_len], return_tensors="pt", sampling_rate=16000).input_features
        feats.append(f.to(dtype=weight_dtype))
    return audio_processor.get_whisper_chunk(feats, device, weight_dtype, whisper, len(pcm16k), fps=FPS,
                                             audio_padding_length_left=2, audio_padding_length_right=2)


@torch.no_grad()
def generate(chunks):
    for i in range(0, len(chunks), BATCH):
        wb = chunks[i:i + BATCH]
        n = wb.shape[0]
        if n < BATCH:
            wb = torch.cat([wb, wb[-1:].repeat(BATCH - n, 1, 1)], dim=0)
        audio_feat = pe(wb.to(device))
        pred = unet.model(LATENT_BATCH, timesteps, encoder_hidden_states=audio_feat).sample
        for face in vae.decode_latents(pred.to(dtype=vae.vae.dtype))[:n]:
            yield face


def load_audio(wav_in):
    """wav → (mono float med tystnad före/efter, rate, whisper-bitar en per bildruta)"""
    with wave.open(wav_in, "rb") as wv:
        rate, nch, sw = wv.getframerate(), wv.getnchannels(), wv.getsampwidth()
        raw = wv.readframes(wv.getnframes())
    assert sw == 2, "16-bit PCM förväntas"
    y = np.frombuffer(raw, dtype=np.int16).reshape(-1, nch).mean(1).astype(np.float32) / 32768.0
    y = np.concatenate([np.zeros(int(PAD_BEFORE_S * rate), np.float32), y, np.zeros(int(PAD_AFTER_S * rate), np.float32)])
    y16 = librosa.resample(y, orig_sr=rate, target_sr=16000) if rate != 16000 else y
    return y, rate, whisper_chunks(y16)[:int(np.floor(len(y) / rate * FPS))]


def faces(wav_in, out):
    """Råa MuseTalk-ansikten (256x256, före sammanfogning) som förlustfri mkv — för att prova
    efterbehandling lokalt utan nytt bygge. Geometrin följer med så sammanfogningen kan återskapas."""
    _, _, chunks = load_audio(wav_in)
    ff = subprocess.Popen([FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", "256x256",
                           "-r", str(FPS), "-i", "-", "-c:v", "libx264rgb", "-crf", "0", "-preset", "slow", out],
                          stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    n = 0
    for face in generate(chunks):
        ff.stdin.write(np.clip(face, 0, 255).astype(np.uint8).tobytes()); n += 1
    ff.stdin.close()
    err = ff.stderr.read().decode(errors="replace")
    assert ff.wait() == 0, f"ffmpeg ansikten: {err[-400:]}"
    return {"frames": n, "bbox": bbox, "crop_box": crop_box, "region2x": [xs, ys, xe, ye], "scale": SCALE}


def _venc(crf, preset, enc):
    if enc == "h264_nvenc":
        return ["-c:v", "h264_nvenc", "-preset", "p5", "-tune", "hq", "-rc", "vbr", "-cq", str(crf), "-b:v", "0",
                "-bf", "0", "-g", "48", "-profile:v", "high"]
    return ["-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-g", "48", "-profile:v", "high"]


def _probe_nvenc():
    """NVENC på 4090/L40S avlastar CPU:n (x264-tråden strypte sessionen vid ~40 fps). Provkodas med
    exakt de flaggor som används; saknas NVENC (H100, ffmpeg utan stöd, drivrutin utan video) → x264."""
    if os.environ.get("NVENC", "1") == "0":
        return False
    r = subprocess.run([FFMPEG, "-v", "error", "-f", "lavfi", "-i", "color=black:s=1080x1920:r=24:d=0.3",
                        "-pix_fmt", "yuv420p", *_venc(19, "ultrafast", "h264_nvenc"), "-f", "null", "-"], capture_output=True, text=True)
    if r.returncode != 0:
        say(status="NVENC saknas — x264: " + r.stderr.strip()[-160:])
    return r.returncode == 0


ENCODER = "h264_nvenc" if _probe_nvenc() else "libx264"


def build_bias():
    """Färgkorrektionskartan: stillbilden − MuseTalks mun på tystnad (stängd mun = modellens systematiska
    fel i nivå och färgton), lågpassad σ 8 så läppformen inte följer med. Uppmätt på Astrid: haka −2,9 → ±0,5."""
    y = np.zeros(16000 * 3, np.float32)
    chunks = whisper_chunks(y)[:3 * FPS]
    smalls = [small_region(f) for i, f in enumerate(generate(chunks)) if PURE_IN + 3 <= i < len(chunks) - 4]
    return cv2.GaussianBlur(base1x - np.mean(smalls, axis=0), (0, 0), BIAS_SIGMA)


def one(wav_in, mp4_out, crf=18, preset="veryfast"):
    import time
    T = {}; t = time.time()
    y, rate, chunks = load_audio(wav_in)
    total = len(chunks)
    T["whisper"] = round(time.time() - t, 2); t = time.time()
    tmp = tempfile.mkdtemp(prefix="ls_")
    vid, wavp = os.path.join(tmp, "v.mp4"), os.path.join(tmp, "a.wav")
    ff = subprocess.Popen([FFMPEG, "-y", "-v", "error",
                           "-f", "rawvideo", "-pix_fmt", "yuv420p", "-s", f"{W}x{H}", "-r", str(FPS), "-color_range", "tv", "-colorspace", "bt709", "-stream_loop", "-1", "-i", BASE_YUV,
                           "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{RW}x{RH}", "-r", str(FPS), "-i", "-",
                           "-filter_complex", f"[1:v]scale=out_color_matrix=bt709:out_range=tv,format=yuva420p[f];[0:v][f]overlay={R1X[0]}:{R1X[1]}:shortest=1:format=yuv420[v]",
                           "-map", "[v]", "-an", "-pix_fmt", "yuv420p",
                           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "iec61966-2-1", "-color_range", "tv",
                           *_venc(crf, preset, ENCODER), vid],
                          stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    # Blandning + x264 i en egen tråd: annars står GPU:n still medan CPU:n kodar varje ruta
    # (uppmätt 2026-09-22 utan tråd: 11 fps på 4090, klippet tog 2,5× sin egen längd).
    q = queue.Queue(maxsize=64)
    box = {}

    def writer():
        try:
            while True:
                item = q.get()
                if item is None:
                    break
                i, face = item
                ff.stdin.write(compose_crop(face, ramp(i, total)).tobytes())
            ff.stdin.close()
        except BrokenPipeError:
            pass
        except Exception as e:  # noqa: BLE001 — felet ska upp till jobbet, inte försvinna i tråden
            box["e"] = e

    wt = threading.Thread(target=writer, daemon=True)
    wt.start()
    for i, face in enumerate(generate(chunks)):
        q.put((i, face))
    T["gpu"] = round(time.time() - t, 2)
    q.put(None)
    wt.join()
    if "e" in box:
        raise box["e"]
    T["gen_enc"] = round(time.time() - t, 2); t = time.time()
    err = ff.stderr.read().decode(errors="replace")
    ff.wait()
    assert ff.returncode == 0, f"ffmpeg video (kod {ff.returncode}): {err[-600:]}"
    with wave.open(wavp, "wb") as wv:
        wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(rate)
        wv.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    os.makedirs(os.path.dirname(mp4_out) or ".", exist_ok=True)
    subprocess.run([FFMPEG, "-y", "-v", "error", "-i", vid, "-i", wavp, "-c:v", "copy", "-c:a", "aac", "-b:a", "96k",
                    "-shortest", "-movflags", "+faststart", mp4_out], check=True)
    for f in (vid, wavp):
        os.remove(f)
    os.rmdir(tmp)
    T["mux"] = round(time.time() - t, 2)
    return total, T


# uppvärmning: ett mini-jobb på 0,5 s tystnad så cudnn/cublas-autotune och ffmpeg-start
# betalas nu och inte av första chattsvaret (uppmätt: förstajobb 36 s, sedan ~5 s)
import time as _time
_t = _time.time()
if POLISH:
    BIAS = build_bias()
    say(status=f"färgkorrektion klar: medel BGR {[round(float(v), 2) for v in BIAS[mask1x > 0.9].mean(0)]}")
_wtmp = tempfile.mkdtemp(prefix="warm_")
_wwav = os.path.join(_wtmp, "w.wav")
with wave.open(_wwav, "wb") as _wv:
    _wv.setnchannels(1); _wv.setsampwidth(2); _wv.setframerate(16000)
    _wv.writeframes(bytes(16000 * 6))  # 6 s: forsta korta uppvarmningen (1 s) lamnade 14 s whisper-kostnad kvar till forsta riktiga jobbet
one(_wwav, os.path.join(_wtmp, "w.mp4"))
for _f in (_wwav, os.path.join(_wtmp, "w.mp4")):
    os.remove(_f)
os.rmdir(_wtmp)
_warm_s = round(_time.time() - _t, 1)
say(status=f"uppvarmd pa {_warm_s}s")

def streaming_infer(pcm, rate, left, start, end, total):
    """Overlapping context windows, emitting only new globally indexed frames.

    Starts/contexts are multiples of 12 frames, hence exact at 16 kHz. Only
    utterance boundaries get ramps; context boundaries never add silence/fades.
    """
    y = np.frombuffer(pcm, dtype='<i2').astype(np.float32) / 32768.0
    y16 = librosa.resample(y, orig_sr=rate, target_sr=16000) if rate != 16000 else y
    from streaming import model_sample_count
    required = model_sample_count(end-left)
    if len(y16) < required:
        y16 = np.pad(y16, (0, required-len(y16)))
    chunks = whisper_chunks(y16)[start-left:end-left]
    # At supported rates the last partial frame may round down by one sample.
    if len(chunks) != end-start:
        raise RuntimeError(f'Whisper frame count {len(chunks)} != {end-start}')
    for i, face in enumerate(generate(chunks), start):
        yield compose_crop(face, ramp(i, total if total is not None else end + 100)).tobytes()


def serve_session(url, ttl, token=None, worker_id=None):
    import asyncio
    import inspect
    import websockets
    from streaming import FragmentMuxer
    from stream_session import serve

    def muxer(rate, emit, cancelled):
        args = _venc(13, 'ultrafast', ENCODER)
        if ENCODER == 'libx264':
            args += ['-tune', 'zerolatency']
        return FragmentMuxer(FFMPEG, BASE_YUV, W, H, RW, RH, R1X[0], R1X[1],
                             rate, args, emit, cancelled)

    def legacy(pcm, rate):
        with tempfile.TemporaryDirectory(prefix='sess_') as tmp:
            wavp, mp4p = os.path.join(tmp, 'a.wav'), os.path.join(tmp, 'v.mp4')
            with wave.open(wavp, 'wb') as wv:
                wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(rate)
                wv.writeframes(pcm)
            n, timings = one(wavp, mp4p, crf=13, preset='ultrafast')
            with open(mp4p, 'rb') as f:
                data = f.read()
            return {'frames': n, 'dur': n/FPS, 'bytes': len(data),
                    'ms': {k: int(v*1000) for k, v in timings.items()}}, data

    async def run():
        headers = {}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        if worker_id:
            headers['X-Worker-Id'] = worker_id
        header_arg = 'additional_headers' if 'additional_headers' in inspect.signature(websockets.connect).parameters else 'extra_headers'
        async with websockets.connect(url, max_size=1024*1024, max_queue=8,
                                      **{header_arg: headers}) as ws:
            try:
                return await serve(ws, ttl, {'avatar': AVATAR, 'encoder': f'{ENCODER}-session',
                                   'polish': POLISH, 'session': True}, streaming_infer, muxer, legacy,
                                   PAD_BEFORE_S, PAD_AFTER_S)
            except websockets.ConnectionClosed:
                return 'closed'
    return asyncio.run(run())


say(ready=True, avatar=AVATAR, size=f"{W}x{H}", warm_s=_warm_s, gpu=torch.cuda.get_device_name(0), region_1x=f"{RW}x{RH}", encoder=ENCODER, polish=POLISH)
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        job = json.loads(line)
        if "session" in job:
            session = job['session']
            reason = serve_session(session['url'], int(session.get('ttl', 540)), session.get('token'), session.get('worker_id'))
            say(ok=True, session=True, reason=reason)
            continue
        if "faces_out" in job:
            say(ok=True, **faces(job["wav"], job["faces_out"]))
            continue
        n, T = one(job["wav"], job["out"], int(job.get("crf", 18)), job.get("preset", "veryfast"))
        say(ok=True, frames=n, t=T)
    except Exception as e:
        say(ok=False, error=f"{type(e).__name__}: {e}")
