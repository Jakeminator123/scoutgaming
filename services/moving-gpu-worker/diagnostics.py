"""Best-effort, fixed-schema worker telemetry; never a source of authorization.

collect() owns one job. phase(name) measures completed and failed stages with
monotonic time. record() accepts only enumerated fields and bounded primitives.
snapshot() is suitable for a private provider result or emit()'s one JSON line.
No arbitrary exception, URL, identifier, PCM, environment or model output is
accepted. Unavailable values remain null. Durations may overlap; never sum them
as a total. Render timings include IPC backpressure, not just CUDA execution.
"""
import contextlib
import contextvars
import json
import math
import re
import sys
import time

_CURRENT = contextvars.ContextVar("moving_worker_diagnostics", default=None)
PHASES = (
    "releaseVerifyMs", "bankReceiptCacheVerifyMs", "bankArchiveCacheVerifyMs",
    "bankReceiptFetchMs", "bankArchiveFetchMs", "bankExtractVerifyMs", "modelsVerifyMs",
    "engineSpawnMs", "enginePrepareMs", "pythonImportsMs", "modelAvatarWarmupMs",
    "callbackConnectMs", "bindWaitMs", "startWaitMs", "pcmReceiveMs",
    "renderWallMs", "chunkSendMs", "chunkAckWaitMs", "engineStopMs",
)
NUMBERS = {
    **{name: 3_600_000 for name in PHASES},
    "jobTotalMs": 3_600_000, "warmupFps": 10_000, "warmupFirstChunkMs": 3_600_000,
    "renderFps": 10_000, "renderMs": 3_600_000, "renderFirstChunkMs": 3_600_000,
    "receivedFirstChunkMs": 3_600_000, "audioFeaturesMs": 3_600_000,
    "composeWaitMs": 3_600_000, "encodeMs": 3_600_000,
    "renderFrames": 600, "sentFrames": 600, "sentChunks": 600, "encodedBytes": 1_200 * 1024 * 1024,
    "launcherPeakRssBytes": 1024 ** 4, "enginePeakRssBytes": 1024 ** 4,
    "gpuTotalBytes": 1024 ** 4, "gpuPeakAllocatedBytes": 1024 ** 4, "gpuPeakReservedBytes": 1024 ** 4,
    "gpuCapabilityMajor": 99, "gpuCapabilityMinor": 99,
}
GPU_NAMES = frozenset({"NVIDIA A40", "NVIDIA RTX A6000", "NVIDIA RTX 6000 Ada Generation",
    "NVIDIA GeForce RTX 3090", "NVIDIA GeForce RTX 4090", "NVIDIA GeForce RTX 5090",
    "NVIDIA A100-SXM4-40GB", "NVIDIA A100-SXM4-80GB", "NVIDIA A100 80GB PCIe",
    "NVIDIA A100-PCIE-40GB", "NVIDIA A100-PCIE-80GB", "NVIDIA L4", "NVIDIA L40", "NVIDIA L40S",
    "NVIDIA H100 PCIe", "NVIDIA H100 80GB HBM3", "NVIDIA H100 NVL", "NVIDIA H200", "NVIDIA B200"})
ENUMS = {"bankReceiptCache": {"hit", "miss", "not_requested"},
         "bankArchiveCache": {"hit", "miss", "not_requested"},
         "outcome": {"complete", "cancelled", "failed"}, "firstFailedPhase": set(PHASES),
         "gpuName": GPU_NAMES | {"other"}}
CHILD_FIELDS = frozenset({"pythonImportsMs", "modelAvatarWarmupMs", "warmupFps", "warmupFirstChunkMs",
    "renderFps", "renderMs", "renderFirstChunkMs", "audioFeaturesMs", "composeWaitMs", "encodeMs",
    "renderFrames", "enginePeakRssBytes", "gpuName", "gpuTotalBytes", "gpuPeakAllocatedBytes",
    "gpuPeakReservedBytes", "gpuCapabilityMajor", "gpuCapabilityMinor", "firstFailedPhase"})


def clock():
    try:
        return time.perf_counter()
    except Exception:
        return None


def elapsed(start):
    end = clock()
    return None if start is None or end is None else max(0, (end - start) * 1000)


class Diagnostics:
    def __init__(self):
        self.values = {name: None for name in (*NUMBERS, *ENUMS, "releaseSha256")}
        self.started = clock()

    def record(self, **fields):
        # Instrumentation must never replace the operational failure or cleanup.
        try:
            for key, value in fields.items():
                if key in NUMBERS and type(value) in (int, float) and math.isfinite(value) and 0 <= value <= NUMBERS[key]:
                    self.values[key] = round(value, 3)
                elif key in ENUMS and type(value) is str and value in ENUMS[key]:
                    if key != "firstFailedPhase" or self.values[key] is None:
                        self.values[key] = value
                elif key == "releaseSha256" and type(value) is str and re.fullmatch(r"[a-f0-9]{64}", value):
                    self.values[key] = value
        except Exception:
            pass

    def add(self, key, value):
        try:
            if key in NUMBERS and type(value) in (int, float) and math.isfinite(value) and value >= 0:
                self.record(**{key: (self.values[key] or 0) + value})
        except Exception:
            pass

    def snapshot(self):
        # Re-sanitize even internal values: no caller-owned object can escape.
        clean = Diagnostics()
        clean.record(**self.values)
        clean.record(jobTotalMs=elapsed(self.started))
        return {"schemaVersion": 1, **clean.values}


@contextlib.contextmanager
def collect():
    collector = Diagnostics()
    token = _CURRENT.set(collector)
    try:
        yield collector
    finally:
        _CURRENT.reset(token)


def record(**fields):
    try:
        collector = _CURRENT.get()
        if collector is not None:
            collector.record(**fields)
    except Exception:
        pass


def add(key, value):
    try:
        collector = _CURRENT.get()
        if collector is not None:
            collector.add(key, value)
    except Exception:
        pass


@contextlib.contextmanager
def phase(name):
    started = clock()
    try:
        yield
    except BaseException:
        try:
            collector = _CURRENT.get()
            if collector is not None and collector.values["firstFailedPhase"] is None:
                collector.record(firstFailedPhase=name)
        except Exception:
            pass
        raise
    finally:
        add(name, elapsed(started))


def merge_engine(value):
    if type(value) is dict:
        record(**{key: value[key] for key in CHILD_FIELDS if key in value})


def render_measurement(value):
    if type(value) is not dict:
        return
    fields = {"renderFps": value.get("rutor_per_s"), "renderMs": value.get("ms"),
              "renderFirstChunkMs": value.get("forsta_bit_ms"), "renderFrames": value.get("rutor")}
    steps = value.get("steg")
    if type(steps) is dict:
        fields.update(audioFeaturesMs=steps.get("ljud_ms"), composeWaitMs=steps.get("vanta_ms"), encodeMs=steps.get("kod_ms"))
    record(**fields)


def resources(torch_module=None, *, engine=False):
    try:
        import resource
        rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        record(**{("enginePeakRssBytes" if engine else "launcherPeakRssBytes"): rss * (1 if sys.platform == "darwin" else 1024)})
    except Exception:
        pass
    # Called only after the real engine has initialized CUDA. No GPU is started
    # by telemetry, and no synchronize/reset alters the production recipe.
    if torch_module is not None:
        try:
            if not torch_module.cuda.is_initialized():
                return
            name = torch_module.cuda.get_device_name(0)
            properties = torch_module.cuda.get_device_properties(0)
            record(gpuName=name if type(name) is str and name in GPU_NAMES else "other",
                   gpuTotalBytes=properties.total_memory, gpuCapabilityMajor=properties.major,
                   gpuCapabilityMinor=properties.minor,
                   gpuPeakAllocatedBytes=torch_module.cuda.max_memory_allocated(0),
                   gpuPeakReservedBytes=torch_module.cuda.max_memory_reserved(0))
        except Exception:
            pass


def emit(snapshot):
    """One fixed JSON object; stderr failure must never change a job result."""
    try:
        clean = Diagnostics()
        if type(snapshot) is dict:
            clean.record(**snapshot)
        print(json.dumps({"event": "moving_worker_diagnostics", "diagnostics": {"schemaVersion": 1, **clean.values}},
                         separators=(",", ":"), allow_nan=False), file=sys.stderr, flush=True)
    except Exception:
        pass
