"""A job-owned subprocess makes disconnect/timeout cancellation enforceable."""
import asyncio
import multiprocessing
import os
import signal
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent


def worker(connection, bank_root, avatar):
    sys.stdout = sys.stderr
    if hasattr(os, "setsid"):
        os.setsid()
    if hasattr(os, "sched_getaffinity"):
        os.sched_setaffinity(0, sorted(os.sched_getaffinity(0))[:4])
    # Fixed production recipe: the desktop MIN_RUTOR=0 override is not inherited.
    os.environ.update(AVATAR_DIR=bank_root, TRADAR="4", MIN_RUTOR="30", DEL="12",
                      JAMNA="0.3", LAPP_CRF="20", OMP_NUM_THREADS="4",
                      OPENBLAS_NUM_THREADS="4", MKL_NUM_THREADS="4",
                      TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD="1",
                      HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1")
    try:
        # Never call vendor Motor.session/pcm_from_url/prefetch. Only the exact
        # offline-verified renderer runs, after all archive bytes were verified.
        sys.path.insert(0, str(ROOT / "vendor"))
        import motor
        import torch
        torch.set_num_threads(4)
        engine = motor.Motor([avatar])
        connection.send(("ready", engine.matt))
        start, pcm = connection.recv()
        def emit(metadata, data):
            connection.send((metadata, data))
        measurement = engine.utterance(avatar, pcm, 24000, start["karta"], emit, start["fran_ruta"])
        connection.send(({"t": "done", **measurement}, None))
    except BaseException:
        # No traceback, path, PCM or credential-bearing provider payloads.
        try:
            connection.send(({"t": "error", "reason": "engine_failed"}, None))
        except (OSError, EOFError):
            pass
    finally:
        connection.close()


class ProcessEngine:
    def __init__(self, bank_root, avatar):
        context = multiprocessing.get_context("spawn")
        self.connection, child = context.Pipe()
        self.process = context.Process(target=worker, args=(child, str(bank_root), avatar), daemon=True)
        self.process.start()
        child.close()
        self.closed = False
        self.measurement = None

    async def prepare(self):
        if self.measurement is not None:
            return self.measurement
        kind, measurement = await asyncio.to_thread(self.connection.recv)
        if kind != "ready":
            raise ValueError("engine_start_failed")
        self.measurement = measurement
        return measurement

    async def begin(self, start, pcm):
        await asyncio.to_thread(self.connection.send, (start, pcm))

    async def next(self):
        return await asyncio.to_thread(self.connection.recv)

    async def close(self):
        if self.closed:
            return
        self.closed = True
        if self.process.is_alive():
            try:
                if hasattr(os, "getpgid") and os.getpgid(self.process.pid) == self.process.pid:
                    os.killpg(self.process.pid, signal.SIGTERM)
                else:
                    self.process.terminate()
            except ProcessLookupError:
                pass
        await asyncio.to_thread(self.process.join, 3)
        if self.process.is_alive():
            try:
                if hasattr(os, "getpgid") and os.getpgid(self.process.pid) == self.process.pid:
                    os.killpg(self.process.pid, signal.SIGKILL)
                else:
                    self.process.kill()
            except ProcessLookupError:
                pass
            await asyncio.to_thread(self.process.join, 3)
        self.connection.close()
        if self.process.is_alive():
            raise RuntimeError("owned_engine_did_not_stop")
