#!/usr/bin/env python3
"""Läppsynkmotorn för rörliga klipp: håller dealerns avatarpaket i minnet och strömmar munlappar.

Paketet (/workspace/avatars/<id>/, byggt av paketera.py) är en pool av dealerns unika bildrutor med förberedelse
per ruta, plus en tabell över vilka poolrutor varje tagning i spelet består av.

En replik = PCM + en bildrutekarta: [[tagning, förstaRuta, antal], …] i spelets tagningsnamn ("pos4-iv", "hole",
"vila" = vilobilden). Lapp k hör till kartans ruta k; ljudet ska börja LJUD_FORE sekunder efter kartans första ruta
(tystnaden före repliken, som i spelets arbetare). Ut kommer bitar om DEL rutor: 256×512 H.264 med munrutans färg
överst och alfan under, plus varje rutas tagning, ruta och läge i bilden — spelet ritar en lapp bara om dess
tagning+ruta är den som visas.
"""
import asyncio, json, os, queue, subprocess, sys, tempfile, threading, time, wave
from collections import OrderedDict
from frame_contract import pcm_frames, resolve_plan, measurement_plan, LEAD_SAMPLES, TRAIL_SAMPLES
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rorlig as R          # färg, modeller, förberedelse (byter katalog till MuseTalk)

import cv2
import numpy as np
import torch

AVATARS = os.environ.get("AVATAR_DIR", "/workspace/avatars")
DEL = int(os.environ.get("DEL", "12"))            # rutor per bit (0,5 s)
LAPP = 256
TRADAR = int(os.environ.get("TRADAR", "8"))
MIN_RUTOR = float(os.environ.get("MIN_RUTOR", "30"))   # under detta hinner arbetaren inte före bilden (spelet kräver detsamma)
JAMNA = float(os.environ.get("JAMNA", "0.3"))     # recept B (Emil 2026-10-12): munnen jämnas mot grannrutorna
LAPP_CRF = int(os.environ.get("LAPP_CRF", "20"))
LJUD_FORE = R.PAD_BEFORE_S
VERSION = "rorlig-9"


def log(**kw):
    print(json.dumps(kw, ensure_ascii=False), flush=True)


class Avatar:
    def __init__(self, aid):
        t = time.time()
        d = f"{AVATARS}/{aid}"
        self.id = aid
        self.info = json.load(open(f"{d}/takes.json"))
        self.takes = self.info["takes"]
        self.frames, self.w, self.h = R.read_yuv(f"{d}/pool.mp4")
        P = R.load_prep(d=f"{d}/prep")
        self.meta, self.bias = P["meta"], P["bias"]
        self.lat = P["lat"].to("cuda:0")
        self.mask = [P["mask"][f"m{i}"].astype(np.float32) / 255.0 for i in range(len(self.frames))]
        # allt ur npz-filerna läses här: zip-läsaren tål inte att blandningstrådarna läser samtidigt
        self._bias = {i: self.bias[f"b{i}"].astype(np.float32) for i in range(len(self.frames))}
        assert len(self.meta) == len(self.frames), "förberedelsen hör inte till poolen"
        # munrutan i 2x för varje ruta räknas här (parallellt, uint8), inte vid första användningen: en ny arbetares
        # första replik för en dealer fick annars betala för alla sina rutor och kom för sent
        with ThreadPoolExecutor(TRADAR) as ex:
            self._reg = list(ex.map(self._reg_of, range(len(self.frames))))
        log(status=f"avatar {aid}: {len(self.frames)} unika rutor, {len(self.takes)} tagningar, {time.time() - t:.1f}s")

    def _reg_of(self, i):
        xs, ys, xe, ye = self.meta[i]["region"]
        return np.clip(R.region2x_of(self.frames[i], xs, ys, xe, ye)[0], 0, 255).astype(np.uint8)

    def reg2x(self, i):
        return self._reg[i].astype(np.float32)

    def bias_of(self, i):
        return self._bias[i]

    def resolve(self, karta, total):
        """Exakt karta utan implicit upprepning, klippning eller stigande viloruta."""
        return resolve_plan(self.info, karta, total)


def compose(A, i, face, a_scale):
    mm = A.meta[i]
    xs, ys, xe, ye = mm["region"]
    small = R.paste_small(face, mm, A.reg2x(i))
    small += A.bias_of(i)
    small += R.SHARP * (small - cv2.GaussianBlur(small, (0, 0), R.SHARP_SIGMA))
    alpha = A.mask[i] * a_scale
    Yn, Un, Vn = R.bgr_to_yuv(np.clip(small, 0, 255))
    Y, U, V = A.frames[i]
    X0, Y0, X1, Y1 = xs // 2, ys // 2, xe // 2, ye // 2
    a2 = alpha.reshape(alpha.shape[0] // 2, 2, alpha.shape[1] // 2, 2).mean((1, 3))
    Yr = np.clip(np.round(alpha * Yn + (1 - alpha) * Y[Y0:Y1, X0:X1]), 0, 255).astype(np.uint8)
    Ur = np.clip(np.round(a2 * Un + (1 - a2) * U[Y0 // 2:Y1 // 2, X0 // 2:X1 // 2]), 0, 255).astype(np.uint8)
    Vr = np.clip(np.round(a2 * Vn + (1 - a2) * V[Y0 // 2:Y1 // 2, X0 // 2:X1 // 2]), 0, 255).astype(np.uint8)
    Yl = cv2.resize(Yr, (LAPP, LAPP), interpolation=cv2.INTER_LINEAR)
    Ul = cv2.resize(Ur, (LAPP // 2, LAPP // 2), interpolation=cv2.INTER_LINEAR)
    Vl = cv2.resize(Vr, (LAPP // 2, LAPP // 2), interpolation=cv2.INTER_LINEAR)
    Al = np.clip(np.round(16 + 219 * cv2.resize(alpha, (LAPP, LAPP), interpolation=cv2.INTER_LINEAR)), 0, 255).astype(np.uint8)
    gray = np.full((LAPP // 2, LAPP // 2), 128, np.uint8)
    raw = np.vstack([Yl, Al]).tobytes() + np.vstack([Ul, gray]).tobytes() + np.vstack([Vl, gray]).tobytes()
    return raw, [X0, Y0, X1 - X0, Y1 - Y0]


EMPTY = bytes([16]) * (LAPP * 2 * LAPP) + bytes([128]) * (LAPP * LAPP)      # Y 256×512 + U och V 128×256 vardera


def encode(frames_raw):
    """en bit → rå H.264 (Annex B): baseline, en IDR först, AUD före varje bildruta och BT.709 i VUI, så att
    webbläsaren kan dela upp den per ruta och avkoda med WebCodecs (codec avc1.42E01F) utan mp4-tolk"""
    ff = subprocess.Popen([R.FFMPEG, "-v", "error", "-f", "rawvideo", "-pix_fmt", "yuv420p", "-s", f"{LAPP}x{2 * LAPP}",
                           "-r", str(R.FPS), "-color_range", "tv", "-colorspace", "bt709", "-i", "-",
                           "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-profile:v", "baseline", "-level", "3.1",
                           "-crf", str(LAPP_CRF), "-pix_fmt", "yuv420p", "-g", str(DEL),
                           "-x264-params", f"aud=1:keyint={DEL}:min-keyint={DEL}:scenecut=0:repeat-headers=1:sliced-threads=0",
                           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
                           "-f", "h264", "-"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    data, err = ff.communicate(b"".join(frames_raw))
    assert ff.returncode == 0, err.decode(errors="replace")[-300:]
    return data


def pcm_from_url(url, rate=24000):
    """replikens ljud från spelets mediaadress (mp4 med AAC) → s16le mono"""
    import urllib.request
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "croupier-lipsync"}), timeout=15) as r:
        data = r.read()
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tf:
        tf.write(data); path = tf.name
    try:
        out = subprocess.run([R.FFMPEG, "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(rate), "-f", "s16le", "-"],
                             capture_output=True, check=True, stdin=subprocess.DEVNULL).stdout
    finally:
        os.remove(path)
    return out


# replikernas ljud per adress (adressen bär klippets version ?v=…): att hämta och avkoda en replik kostar ~0,7 s, och
# samma repliker (good luck varje runda) kommer om och om igen; cachen lever så länge arbetaren gör, över sessioner
_PCM, _PCM_LOCK = OrderedDict(), threading.Lock()


def pcm_cached(url):
    with _PCM_LOCK:
        if url in _PCM:
            _PCM.move_to_end(url)
            return _PCM[url]
    pcm = pcm_from_url(url)
    with _PCM_LOCK:
        _PCM[url] = pcm
        while len(_PCM) > 300:
            _PCM.popitem(last=False)
    return pcm


def prefetch(urls):
    """hämtar repliker i förväg (servern säger vilka: de som spelas vid rundstart), fel tystas"""
    for u in urls:
        try:
            pcm_cached(u)
        except Exception:  # noqa: BLE001
            pass


def audio_chunks(pcm16, rate):
    import librosa
    total = pcm_frames(len(pcm16), rate)
    y = np.frombuffer(pcm16, np.int16).astype(np.float32) / 32768.0
    y = np.concatenate([np.zeros(LEAD_SAMPLES, np.float32), y, np.zeros(TRAIL_SAMPLES, np.float32)])
    y16 = librosa.resample(y, orig_sr=rate, target_sr=16000) if rate != 16000 else y
    chunks = R.whisper_chunks(y16)
    if len(chunks) < total:
        raise ValueError("incomplete_audio_features")
    # Resampling can produce one feature beyond the source PCM's exact duration.
    # No output frame is fabricated, repeated or removed to fit an invalid plan.
    return y, chunks[:total]


class Avbruten(Exception):
    """servern ersatte jobbets karta med en nyare: resten görs inte"""


class Motor:
    def __init__(self, avatars):
        t = time.time()
        R.models()
        self.av = {a: Avatar(a) for a in avatars}
        self.pool = ThreadPoolExecutor(TRADAR)
        self.gpu = torch.cuda.get_device_name(0)
        # uppvärmning + mätning: en replik på 3 s tystnad över en riktig tagning
        # varje dealer värms (inte bara den första): ett kort tal över hans längsta tagning, sedan en mätning
        for a in self.av.values():
            self.measure(a.id)
        self.matt = self.measure(a.id)
        log(ready=True, gpu=self.gpu, avatarer=list(self.av), s=round(time.time() - t, 1), **self.matt)

    def utterance(self, aid, pcm16, rate, karta, emit, fran=0, stopp=None):
        """en replik: emit(meddelande, binärt|None) för varje bit; returnerar tider.
        fran = första ruta som behövs (en ny karta när planen ändrats mitt i repliken): rutorna före den finns redan hos
        spelarna, så bara resten görs — första biten kommer lika fort som för en ny replik."""
        t0 = time.time()
        A = self.av[aid]
        y, chunks = audio_chunks(pcm16, rate)
        T = {"ljud_ms": int((time.time() - t0) * 1000), "vanta_ms": 0, "kod_ms": 0}   # var tiden går (felsökning)
        total = len(chunks)
        plan = A.resolve(karta, total)
        TV = R.talvikt(y, rate, total)
        fran = max(0, min(int(fran), total - 1))
        s0 = max(0, fran - 1)   # en ruta före, så att utjämningen (recept B) har sin granne
        lat = torch.stack([A.lat[p if p is not None else A.info["vila"]] for _, _, p in plan[s0:]])
        futs = [None] * total
        ready = queue.Queue()

        def gpu():
            prev = prev2 = None
            k = s0
            # recept B med en rutas fördröjning: ruta k jämnas mot k−1 och k+1
            for face in R.generate(lat, chunks[s0:]):
                if stopp is not None and stopp.is_set():
                    break
                f = face.astype(np.float32)
                if prev is not None:
                    self._submit(A, plan, futs, k - 1, prev, prev2, f, total, TV, ready)
                prev2, prev = prev, f
                k += 1
            if prev is not None:
                self._submit(A, plan, futs, k - 1, prev, prev2, None, total, TV, ready)
            ready.put(None)

        gt = threading.Thread(target=gpu, daemon=True)
        gt.start()
        done_upto, first_ms, n = s0 - 1, None, 0
        for d0 in range(fran, total, DEL):
            d1 = min(d0 + DEL, total)
            tw = time.time()
            while done_upto < d1 - 1:
                item = ready.get()
                if item is None:
                    break
                done_upto = item
            raws, rutor = [], []
            for k in range(d0, d1):
                take, f, p = plan[k]
                r = futs[k].result() if futs[k] is not None else None
                if r is None:
                    raws.append(EMPTY); rutor.append(None)
                else:
                    raws.append(r[0]); rutor.append({"tagning": take, "ruta": f, "rect": r[1]})
            T["vanta_ms"] += int((time.time() - tw) * 1000)
            tk = time.time()
            data = encode(raws)
            T["kod_ms"] += int((time.time() - tk) * 1000)
            emit({"t": "lapp", "del": n, "fran": d0, "till": d1, "rutor": rutor, "bytes": len(data)}, data)
            if first_ms is None:
                first_ms = int((time.time() - t0) * 1000)
            n += 1
        gt.join()
        # A resumed utterance also submits the lookbehind frame (fran - 1).
        # It is not emitted above, but its composition must finish successfully
        # before a cached Motor can accept another utterance.
        for future in futs:
            if future is not None:
                future.result()
        ms = int((time.time() - t0) * 1000)
        return {"rutor": total, "fran": fran, "delar": n, "forsta_bit_ms": first_ms, "ms": ms, "ljud_fore_s": LJUD_FORE, "steg": T,
                "rutor_per_s": round((total - fran) / max(ms / 1000, 1e-3), 1)}

    def measure(self, aid):
        """en replik på 3 s tystnad över dealerns längsta tagning: första bit och rutor/s just nu"""
        a = self.av[aid]
        pcm = bytes(24000 * 2 * 3)
        karta = measurement_plan(a.info, pcm_frames(len(pcm)))
        res = self.utterance(aid, pcm, 24000, karta, lambda m, b: None)
        return {"forsta_bit_ms": res["forsta_bit_ms"], "rutor_per_s": res["rutor_per_s"]}

    def _submit(self, A, plan, futs, k, cur, prev, nxt, total, TV, ready):
        a = R.ramp(k, total) * TV[k]
        p = plan[k][2]
        if a > 0 and p is not None:
            if JAMNA > 0:
                cur = (1 - JAMNA) * cur + JAMNA * 0.5 * ((prev if prev is not None else cur) + (nxt if nxt is not None else cur))
            futs[k] = self.pool.submit(compose, A, p, np.clip(cur, 0, 255), a)
        ready.put(k)

    # ---------------------------------------------------------------- session ---
    def session(self, url, ttl=540, avatar=None):
        """ringer upp spelservern (omvänd WebSocket) och kör protokollet tills ttl gått, servern säger bye eller stänger"""
        # RunPod's SDK runs the handler inside its own event loop: the session gets a loop of its own in a thread
        box = {}

        def run():
            try:
                box["r"] = asyncio.run(self._session(url, ttl, avatar))
            except Exception as e:  # noqa: BLE001
                box["e"] = e

        t = threading.Thread(target=run, daemon=True)
        t.start()
        t.join()
        if "e" in box:
            raise box["e"]
        # en maskin som är för långsam (det händer: 14,5 rutor/s på en 4090 den 13 okt) byts ut av RunPod efter jobbet,
        # annars får den nästa session igen
        return {**box["r"], **({"refresh_worker": True} if box["r"].get("langsam") else {})}

    async def _session(self, url, ttl, avatar):
        import websockets
        aid = avatar or (parse_qs(urlparse(url).query).get("avatar") or [None])[0] or next(iter(self.av))
        if aid not in self.av:
            return {"reason": f"okänd avatar {aid}"}
        loop = asyncio.get_running_loop()
        # mätt nu, inte vid maskinens start: spelet tar bara emot en arbetare som hinner (rutor_per_s >= 30)
        matt = await asyncio.to_thread(self.measure, aid)
        end_at = time.time() + ttl
        reason = "ttl"
        async with websockets.connect(url, max_size=None, ping_interval=20) as ws:
            await ws.send(json.dumps({"t": "pong", "avatar": aid, "motor": VERSION, "gpu": self.gpu,
                                      "ljud_fore_s": LJUD_FORE, "del_rutor": DEL, "samma_ljud": True, "spar": 2, **matt}))
            cur = None
            # svarens ljud per ljud_id (svarets id): en ny karta för samma svar (spelaren tog hit medan dealern pratar)
            # kommer med samma_ljud i stället för ljudet en gång till — att skicka det igen kostade ~0,5 s
            ljud = OrderedDict()
            # två jobb får gå samtidigt (servern ger andra spåret bara till det som behövs strax): ett brådskande ombygge
            # väntade annars 1,3–1,6 s bakom en replik som skulle spelas senare. GPU:n gör 55–60 rutor/s, ett spår behöver 24.
            # Allt till servern går genom en kö, så att en lapps meta och dess binära bit alltid ligger intill varandra.
            out = asyncio.Queue()
            stopp = {}   # jobb-id -> Event: servern avbryter en version som en nyare karta ersatt

            async def sander():
                while True:
                    meta, data = await out.get()
                    await ws.send(json.dumps(meta))
                    if data is not None:
                        await ws.send(data)

            st = asyncio.create_task(sander())
            try:
                while True:
                    left = end_at - time.time()
                    if left <= 0:
                        break
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=left)
                    except asyncio.TimeoutError:
                        break
                    except websockets.ConnectionClosed:
                        reason = "stängd"
                        break
                    if isinstance(msg, bytes):
                        if cur is not None:
                            cur["pcm"] += msg
                        continue
                    m = json.loads(msg)
                    t = m.get("t")
                    if t == "start":
                        cur = {"id": m["id"], "ljud_id": m.get("ljud_id") or m["id"], "rate": int(m.get("rate", 24000)),
                               "karta": m.get("karta") or [], "pcm": bytearray(), "fran": int(m.get("fran_ruta", 0) or 0),
                               "ljud_url": m.get("ljud_url")}
                        if m.get("samma_ljud"):
                            cur["pcm"] += ljud.get(cur["ljud_id"], b"")
                    elif t == "end" and cur is not None and cur["id"] == m.get("id"):
                        job, cur = cur, None
                        if job["pcm"]:
                            ljud[job["ljud_id"]] = bytes(job["pcm"])
                            while len(ljud) > 30:
                                ljud.popitem(last=False)
                        ev = stopp[job["id"]] = threading.Event()

                        def emit(meta, data, job=job, ev=ev):
                            if ev.is_set():
                                raise Avbruten()
                            loop.call_soon_threadsafe(out.put_nowait, ({"id": job["id"], **meta}, data))

                        def run(job=job, emit=emit, ev=ev):
                            try:
                                pcm, rate = bytes(job["pcm"]), job["rate"]
                                if job.get("ljud_url") and not pcm:
                                    pcm, rate = pcm_cached(job["ljud_url"]), 24000
                                res = self.utterance(aid, pcm, rate, job["karta"], emit, job.get("fran", 0), ev)
                                loop.call_soon_threadsafe(out.put_nowait, ({"t": "done", "id": job["id"], **res}, None))
                            except Avbruten:
                                loop.call_soon_threadsafe(out.put_nowait, ({"t": "error", "id": job["id"], "reason": "avbruten"}, None))
                            except Exception as e:  # noqa: BLE001 — felet ska till servern, inte döda sessionen
                                loop.call_soon_threadsafe(out.put_nowait, ({"t": "error", "id": job["id"], "reason": repr(e)[:300]}, None))
                            finally:
                                stopp.pop(job["id"], None)

                        threading.Thread(target=run, daemon=True).start()
                    elif t == "avbryt":
                        if m.get("id") in stopp:
                            stopp[m["id"]].set()
                    elif t == "forhamta":
                        threading.Thread(target=prefetch, args=([str(u) for u in m.get("urls") or []][:40],), daemon=True).start()
                    elif t == "ping":
                        out.put_nowait(({"t": "pong", "avatar": aid}, None))
                    elif t == "bye":
                        reason = "bye"
                        break
                # det som redan görs skickas klart (högst 15 s)
                for _ in range(150):
                    if not stopp and out.empty():
                        break
                    await asyncio.sleep(0.1)
            finally:
                st.cancel()
        return {"reason": reason, **matt, "langsam": matt["rutor_per_s"] < MIN_RUTOR}


def avatars_on_disk():
    want = [a for a in os.environ.get("AVATARS", "").split() if a]
    have = sorted(d for d in os.listdir(AVATARS) if os.path.exists(f"{AVATARS}/{d}/takes.json"))
    return [a for a in want if a in have] if want else have


if __name__ == "__main__":
    # fristående prov: python motor.py <avatar> <wav> '<karta som JSON>' <utmapp>
    aid, wav, karta, ut = sys.argv[1:5]
    os.makedirs(ut, exist_ok=True)
    M = Motor([aid])
    with wave.open(wav) as w:
        pcm, rate = w.readframes(w.getnframes()), w.getframerate()
    pieces = []

    def emit(meta, data):
        p = f"{ut}/del{meta['del']:03d}.h264"
        open(p, "wb").write(data)
        json.dump(meta, open(p[:-5] + ".json", "w"))
        pieces.append(meta)

    log(**M.utterance(aid, pcm, rate, json.loads(karta), emit))
