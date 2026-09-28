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
import base64, json, os, subprocess, tempfile, threading, time, uuid

import runpod

CMD = ["/workspace/mt-venv/bin/python", "-u", "/workspace/workers/lipsync_worker.py"]


class Engine:
    def __init__(self):
        self.lock = threading.Lock()
        # stderr in i samma rör: kraschar motorn vill vi ha tracebacken i felmeddelandet, inte bara "dog"
        self.proc = subprocess.Popen(CMD, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.STDOUT, text=True, bufsize=1)
        self.tail = []
        self.ready = None
        while True:
            msg = self._read("motorn dog under start")
            if msg.get("ready"):
                self.ready = msg
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
        if not str(inp.get("ws_url", "")).startswith(("ws://", "wss://")):
            return {"error": "session kräver ws_url"}
        session = {"url": inp["ws_url"], "ttl": min(900, max(1, int(inp.get("ttl", 540))))}
        for field, target in (("ws_token", "token"), ("worker_id", "worker_id")):
            if inp.get(field):
                session[target] = str(inp[field])
        res = ENGINE.run({"session": session})
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
