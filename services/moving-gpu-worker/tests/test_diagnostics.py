import asyncio
import io
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import diagnostics as diag


class DiagnosticsTests(unittest.TestCase):
    def test_fixed_schema_drops_secrets_invalid_numbers_and_unknown_gpu_names(self):
        with diag.collect() as collector:
            diag.record(callbackUrl="https://private?token=secret", nonce="secret", pcm=b"secret", exactText="secret",
                        gpuName="NVIDIA secret-token", warmupFps=float("nan"), encodeMs=True,
                        renderMs=-1, gpuTotalBytes=2 ** 50, releaseSha256="https://secret")
            diag.record(warmupFps=32.5, gpuName="NVIDIA GeForce RTX 4090", releaseSha256="a" * 64)
            diag.render_measurement({"rutor": 42, "rutor_per_s": 33.4, "ms": 1234, "forsta_bit_ms": 456,
                "steg": {"ljud_ms": 100, "vanta_ms": 200, "kod_ms": 300, "callback": "secret"}, "private": "secret"})
            snapshot = collector.snapshot()
        self.assertEqual(snapshot["warmupFps"], 32.5)
        self.assertEqual(snapshot["encodeMs"], 300)
        self.assertEqual(snapshot["renderFrames"], 42)
        self.assertIsNone(snapshot["gpuTotalBytes"])
        self.assertNotIn("secret", json.dumps(snapshot))
        self.assertEqual(set(snapshot), {"schemaVersion", "releaseSha256", *diag.NUMBERS, *diag.ENUMS})

    def test_failed_and_cancelled_phase_retains_first_cause_and_elapsed_time(self):
        with diag.collect() as collector:
            with self.assertRaises(ValueError):
                with diag.phase("bankExtractVerifyMs"):
                    raise ValueError("private callback")
            with self.assertRaises(asyncio.CancelledError):
                with diag.phase("engineStopMs"):
                    raise asyncio.CancelledError()
            snapshot = collector.snapshot()
        self.assertEqual(snapshot["firstFailedPhase"], "bankExtractVerifyMs")
        self.assertGreaterEqual(snapshot["bankExtractVerifyMs"], 0)
        self.assertGreaterEqual(snapshot["engineStopMs"], 0)

    def test_nested_collectors_restore_ownership_and_child_merge_is_allowlisted(self):
        with diag.collect() as outer:
            diag.record(bankArchiveCache="hit")
            with diag.collect() as inner:
                diag.record(bankArchiveCache="miss")
            diag.merge_engine({"gpuName": "NVIDIA A40", "warmupFps": 40, "bankArchiveCache": "miss",
                               "releaseSha256": "b" * 64, "callback": "secret"})
            self.assertEqual(outer.snapshot()["bankArchiveCache"], "hit")
            self.assertEqual(inner.snapshot()["bankArchiveCache"], "miss")
            self.assertEqual(outer.snapshot()["warmupFps"], 40)
            self.assertIsNone(outer.snapshot()["releaseSha256"])
        diag.record(warmupFps=90)
        self.assertEqual(outer.snapshot()["warmupFps"], 40)

    def test_child_failure_precedes_parent_phase_and_unknown_phase_is_ignored(self):
        with diag.collect() as collector:
            diag.merge_engine({"firstFailedPhase": "private callback"})
            self.assertIsNone(collector.snapshot()["firstFailedPhase"])
            with self.assertRaises(ValueError):
                with diag.phase("enginePrepareMs"):
                    diag.merge_engine({"firstFailedPhase": "modelAvatarWarmupMs"})
                    raise ValueError("engine_start_failed")
            self.assertEqual(collector.snapshot()["firstFailedPhase"], "modelAvatarWarmupMs")
            diag.merge_engine({"firstFailedPhase": "pythonImportsMs"})
            self.assertEqual(collector.snapshot()["firstFailedPhase"], "modelAvatarWarmupMs")

    def test_resource_probe_does_not_initialize_cuda_or_export_arbitrary_names(self):
        cuda = SimpleNamespace(is_initialized=lambda: False, get_device_name=Mock(side_effect=AssertionError("must not initialize")))
        with diag.collect() as collector:
            diag.resources(SimpleNamespace(cuda=cuda), engine=True)
            self.assertIsNone(collector.snapshot()["gpuName"])
            cuda.is_initialized = lambda: True
            cuda.get_device_name = lambda _: "NVIDIA private callback"
            cuda.get_device_properties = lambda _: SimpleNamespace(total_memory=24 * 1024 ** 3, major=8, minor=9)
            cuda.max_memory_allocated = lambda _: 12345
            cuda.max_memory_reserved = lambda _: 20000
            diag.resources(SimpleNamespace(cuda=cuda), engine=True)
            snapshot = collector.snapshot()
        self.assertEqual(snapshot["gpuName"], "other")
        self.assertEqual(snapshot["gpuTotalBytes"], 24 * 1024 ** 3)
        self.assertEqual(snapshot["gpuPeakAllocatedBytes"], 12345)
        self.assertNotIn("private", json.dumps(snapshot))

    def test_stderr_failures_and_unavailable_clock_do_not_raise(self):
        output = io.StringIO()
        with patch.object(sys, "stderr", output):
            diag.emit({"warmupFps": 31, "callbackUrl": "private", "encodeMs": float("inf")})
        parsed = json.loads(output.getvalue())
        self.assertEqual(parsed["event"], "moving_worker_diagnostics")
        self.assertEqual(parsed["diagnostics"]["warmupFps"], 31)
        self.assertNotIn("private", output.getvalue())
        with patch.object(sys, "stderr", SimpleNamespace(write=Mock(side_effect=OSError("private")))):
            diag.emit(parsed["diagnostics"])
        with patch.object(diag.time, "perf_counter", side_effect=OSError("unavailable")), diag.collect() as collector:
            with diag.phase("modelsVerifyMs"):
                pass
            self.assertIsNone(collector.snapshot()["jobTotalMs"])
            self.assertIsNone(collector.snapshot()["modelsVerifyMs"])
