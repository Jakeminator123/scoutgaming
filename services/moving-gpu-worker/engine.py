"""One exclusive renderer process; only a completed generation may be reused."""
import asyncio
import multiprocessing
import os
import signal
from pathlib import Path
import sys
import threading
import diagnostics as diag

ROOT = Path(__file__).resolve().parent


def render(engine, avatar, payload, emit):
    # This call frame (including PCM/plan/futures in Motor) is gone before done.
    start, pcm = payload
    return engine.utterance(avatar, pcm, 24000, start["karta"], emit, start["fran_ruta"])


def serve_engine(connection, engine, avatar, torch, initial):
    """Internal generation protocol only; no callback or provider credentials."""
    generation = 0
    connection.send((generation, "ready", initial))
    while True:
        received, kind, payload = connection.recv()
        if type(received) is not int or received != generation or kind != "render":
            raise ValueError("engine_protocol_error")
        with diag.collect() as diagnostics:
            def emit(metadata, data):
                connection.send((generation, metadata, data))
            try:
                measurement = render(engine, avatar, payload, emit)
                del payload
                diag.render_measurement(measurement)
                diag.resources(torch, engine=True)
                connection.send((generation, {"t": "done", **measurement, "_diagnostics": diagnostics.snapshot()}, None))
            except BaseException:
                connection.send((-1, {"t": "error", "reason": "engine_failed", "_diagnostics": diagnostics.snapshot()}, None))
                return
        received, kind, payload = connection.recv()
        if type(received) is not int or (received, kind, payload) != (generation, "release", None):
            raise ValueError("engine_protocol_error")
        connection.send((generation, "idle", None))
        received, kind, payload = connection.recv()
        if type(received) is not int or received != generation + 1 or kind != "prepare" or payload is not None:
            raise ValueError("engine_protocol_error")
        generation = received
        # A cached startup number is not current readiness. Measure the same
        # fixed three-second synthetic plan again, without rebuilding Motor.
        with diag.collect() as diagnostics:
            try:
                with diag.phase("warmupCheckMs"):
                    measurement = engine.measure(avatar)
                diag.record(warmupFps=measurement.get("rutor_per_s"), warmupFirstChunkMs=measurement.get("forsta_bit_ms"))
                diag.resources(torch, engine=True)
                connection.send((generation, "ready", {**measurement, "_diagnostics": diagnostics.snapshot()}))
            except BaseException:
                connection.send((-1, {"t": "error", "reason": "engine_failed", "_diagnostics": diagnostics.snapshot()}, None))
                return


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
    with diag.collect() as diagnostics:
        try:
            # Never call vendor Motor.session/pcm_from_url/prefetch. Only the exact
            # pinned renderer plus reviewed frame-contract patches runs after bank verification.
            with diag.phase("pythonImportsMs"):
                sys.path.insert(0, str(ROOT / "vendor"))
                import motor
                import torch
                torch.set_num_threads(4)
            # Combined by design: Motor owns model, avatar and two warmup runs.
            with diag.phase("modelAvatarWarmupMs"):
                engine = motor.Motor([avatar])
            diag.record(warmupFps=engine.matt.get("rutor_per_s"), warmupFirstChunkMs=engine.matt.get("forsta_bit_ms"))
            diag.resources(torch, engine=True)
            serve_engine(connection, engine, avatar, torch,
                         {**engine.matt, "_diagnostics": diagnostics.snapshot()})
        except BaseException:
            # No traceback, path, PCM or credential-bearing provider payloads.
            try:
                connection.send((-1, {"t": "error", "reason": "engine_failed", "_diagnostics": diagnostics.snapshot()}, None))
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
        self.generation = 0
        self.state = "preparing"
        self._close_lock = threading.Lock()

    async def _receive(self):
        generation, metadata, data = await asyncio.to_thread(self.connection.recv)
        if type(generation) is not int or generation != self.generation:
            if generation == -1 and isinstance(metadata, dict):
                diag.merge_engine(metadata.get("_diagnostics"))
            raise ValueError("engine_generation_mismatch")
        return metadata, data

    async def prepare(self):
        if self.closed or self.state not in ("preparing", "prepared", "idle"):
            raise ValueError("engine_state_mismatch")
        if self.state == "prepared":
            return self.measurement
        if self.state == "idle":
            self.generation += 1
            self.state = "preparing"
            await asyncio.to_thread(self.connection.send, (self.generation, "prepare", None))
        kind, measurement = await self._receive()
        if isinstance(kind, dict):
            diag.merge_engine(kind.get("_diagnostics"))
        if kind != "ready" or not isinstance(measurement, dict):
            raise ValueError("engine_start_failed")
        diag.merge_engine(measurement.get("_diagnostics"))
        self.measurement = {key: value for key, value in measurement.items() if key != "_diagnostics"}
        self.state = "prepared"
        return self.measurement

    async def begin(self, start, pcm):
        if self.closed or self.state != "prepared":
            raise ValueError("engine_state_mismatch")
        self.state = "rendering"
        await asyncio.to_thread(self.connection.send, (self.generation, "render", (start, pcm)))

    async def next(self):
        if self.closed or self.state != "rendering":
            raise ValueError("engine_state_mismatch")
        metadata, data = await self._receive()
        if isinstance(metadata, dict):
            diag.merge_engine(metadata.get("_diagnostics"))
            metadata = {key: value for key, value in metadata.items() if key != "_diagnostics"}
            if metadata.get("t") == "done":
                self.state = "completed"
        return metadata, data

    async def finish(self):
        if self.closed or self.state != "completed":
            raise ValueError("engine_state_mismatch")
        await asyncio.to_thread(self.connection.send, (self.generation, "release", None))
        if await self._receive() != ("idle", None):
            raise ValueError("engine_state_mismatch")
        self.measurement = None
        self.state = "idle"

    async def close(self):
        # Await process death even if a second cancellation arrives during cleanup.
        task = asyncio.create_task(asyncio.to_thread(self.close_sync))
        interrupted = False
        while not task.done():
            try:
                await asyncio.shield(task)
            except asyncio.CancelledError:
                interrupted = True
        task.result()
        if interrupted:
            raise asyncio.CancelledError()

    def close_sync(self):
        with self._close_lock:
            self._close_sync()

    def _close_sync(self):
        if self.closed:
            return
        if self.process.is_alive():
            try:
                if hasattr(os, "getpgid") and os.getpgid(self.process.pid) == self.process.pid:
                    os.killpg(self.process.pid, signal.SIGTERM)
                else:
                    self.process.terminate()
            except ProcessLookupError:
                pass
        self.process.join(3)
        if self.process.is_alive():
            try:
                if hasattr(os, "getpgid") and os.getpgid(self.process.pid) == self.process.pid:
                    os.killpg(self.process.pid, signal.SIGKILL)
                else:
                    self.process.kill()
            except ProcessLookupError:
                pass
            self.process.join(3)
        self.connection.close()
        if self.process.is_alive():
            raise RuntimeError("owned_engine_did_not_stop")
        self.closed = True
        self.state = "closed"
