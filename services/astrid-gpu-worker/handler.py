#!/usr/bin/env python3
"""RunPod Serverless-handler för Astrid-läppsynken (Croupier).

Motorn (MuseTalk 1.5) körs som en persistent underprocess i mt-venv och laddas vid kallstart.

Jobb (input):
  {"op": "health"}                                                   → status för motorn
  {"op": "lipsync", "wav_b64": "<wav 16-bit PCM>"}                   → {"mp4_b64": ..., "frames": n, "t": {...}}
  {"op": "session", "ws_url": "wss://.../lipsync-worker", "ws_token": "...", "worker_id": "gpu-1"}
      → ringer upp gatewayen med Authorization-header och kör protokoll v1/v2 tills ttl
      (s, standard 540, högst 900) gått ut eller servern säger bye
  {"op": "faces", "wav_b64": ...}   → råa 256-ansikten (förlustfri mkv) + mask och geometri, för att
      prova efterbehandling lokalt
Valfritt för lipsync: "crf" (standard 18), "preset" (standard veryfast).
"""
import base64, ipaddress, json, os, re, subprocess, tempfile, threading, time, uuid
from urllib.parse import urlsplit

import runpod

CMD = ["/workspace/mt-venv/bin/python", "-u", "/workspace/workers/lipsync_worker.py"]


class Engine:
    def __init__(self):
        started = time.monotonic()
        self.lock = threading.Lock()
        # stderr in i samma rör: kraschar motorn vill vi ha tracebacken i felmeddelandet, inte bara "dog"
        self.proc = subprocess.Popen(CMD, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.STDOUT, text=True, bufsize=1)
        self.tail = []
        self.ready = None
        while True:
            msg = self._read("motorn dog under start")
            if msg.get("ready"):
                self.ready = {**msg, "cold_start_ms": round((time.monotonic() - started) * 1000)}
                break
            if msg.get("ok") is False:
                raise RuntimeError(msg.get("error"))

    def _read(self, died_msg):
        """Nästa JSON-rad från motorn; icke-JSON (t.ex. traceback) loggas och sparas i svansen."""
        while True:
            line = self.proc.stdout.readline()
            if not line:
                raise RuntimeError(f"{died_msg} (kod {self.proc.poll()}): " + " | ".join(self.tail[-12:]))
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except ValueError:
                self.tail.append(line[:300])
                print(f"[lipsync] {line[:300]}", flush=True)
                continue
            print(f"[lipsync] {msg}", flush=True)
            return msg

    def run(self, job):
        with self.lock:
            self.proc.stdin.write(json.dumps(job) + "\n")
            self.proc.stdin.flush()
            res = self._read("motorn dog")
        if not res.get("ok"):
            raise RuntimeError(res.get("error"))
        return res


_t0 = time.time()
ENGINE = None
ERROR = None
try:
    ENGINE = Engine()
except Exception as e:
    ERROR = str(e)
    print(f"[lipsync] STARTFEL: {e}", flush=True)
print(f"motor {'varm' if ENGINE else 'TRASIG'} · {time.time()-_t0:.0f}s", flush=True)


def _tmp(suffix):
    return os.path.join(tempfile.gettempdir(), f"{uuid.uuid4().hex}{suffix}")


def handler(job):
    inp = job.get("input") or {}
    op = inp.get("op", "health")
    if op == "health":
        return {"warm": ENGINE.ready if ENGINE else None, "error": ERROR}
    if ENGINE is None:
        return {"error": f"läppsynkmotorn startade inte: {ERROR}"}
    if op == "session":
        try:
            target = urlsplit(inp.get("ws_url", ""))
        except (ValueError, TypeError):
            target = urlsplit("")
        try:
            local = target.hostname is not None and ipaddress.ip_address(target.hostname).is_loopback
        except ValueError:
            local = False
        if (target.scheme != "wss" and not (target.scheme == "ws" and local)) or not target.hostname \
                or target.path != "/lipsync-worker" or target.query or target.fragment or target.username or target.password:
            return {"error": "session kräver ws_url"}
        token, worker_id = inp.get("ws_token"), inp.get("worker_id")
        if not isinstance(token, str) or not 32 <= len(token) <= 2048 or any(c.isspace() for c in token) \
                or not isinstance(worker_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", worker_id):
            return {"error": "session kräver privat token och worker_id"}
        try:
            ttl = int(inp.get("ttl", 540))
        except (TypeError, ValueError):
            return {"error": "session kräver giltig ttl"}
        session = {"url": inp["ws_url"], "ttl": min(900, max(1, ttl))}
        session["token"] = token
        session["worker_id"] = worker_id
        try:
            res = ENGINE.run({"session": session})
        except Exception:
            # Provider and socket exceptions may contain internal addresses.
            # Never return or log their raw text for a credential-bearing job.
            return {"error": "session failed"}
        return {"session": True, "reason": res.get("reason")}
    if op == "faces":
        # verktyg: råa MuseTalk-ansikten + avatarens mask/geometri för att prova efterbehandling lokalt
        if "wav_b64" not in inp:
            return {"error": "faces kräver wav_b64"}
        wav, mkv = _tmp(".wav"), _tmp(".mkv")
        try:
            with open(wav, "wb") as f:
                f.write(base64.b64decode(inp["wav_b64"]))
            res = ENGINE.run({"wav": wav, "faces_out": mkv})
            adir = f"/workspace/MuseTalk/results/v15/avatars/{os.environ.get('AVATAR_ID', 'astrid_talk2x')}"
            with open(mkv, "rb") as f, open(f"{adir}/mask/00000000.png", "rb") as m:
                return {"faces_mkv_b64": base64.b64encode(f.read()).decode(), "mask_png_b64": base64.b64encode(m.read()).decode(),
                        **{k: res[k] for k in ("frames", "bbox", "crop_box", "region2x", "scale")}}
        except Exception as e:
            return {"error": str(e)}
        finally:
            for p in (wav, mkv):
                try:
                    os.remove(p)
                except OSError:
                    pass
    if op != "lipsync":
        return {"error": f"okänd op: {op}"}
    if "wav_b64" not in inp:
        return {"error": "lipsync kräver wav_b64"}
    wav, mp4 = _tmp(".wav"), _tmp(".mp4")
    try:
        with open(wav, "wb") as f:
            f.write(base64.b64decode(inp["wav_b64"]))
        l_job = {"wav": wav, "out": mp4}
        for k in ("crf", "preset"):
            if k in inp:
                l_job[k] = inp[k]
        res = ENGINE.run(l_job)
        with open(mp4, "rb") as f:
            return {"mp4_b64": base64.b64encode(f.read()).decode(), "frames": res["frames"], "t": res.get("t")}
    except Exception as e:
        return {"error": str(e)}
    finally:
        for p in (wav, mp4):
            try:
                os.remove(p)
            except OSError:
                pass


runpod.serverless.start({"handler": handler})
