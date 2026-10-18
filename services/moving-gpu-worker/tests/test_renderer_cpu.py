"""Run real vendor helpers and MuseTalk chunking without weights or a GPU.

The full locked container runs these tests. A stdlib-only host skips them;
WSL can supply its existing checkout with MOVING_TEST_MUSETALK_ROOT.
"""
import importlib.util
import os
from pathlib import Path
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from types import SimpleNamespace, ModuleType
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from contracts import validate_pcm
from frame_contract import pcm_frames


class RendererCPU(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        musetalk = Path(os.environ.get("MOVING_TEST_MUSETALK_ROOT", "/workspace/MuseTalk"))
        if not musetalk.is_dir():
            raise unittest.SkipTest("Full locked renderer checkout is not installed on this host")
        # An installed renderer must pass: dependency/import failures are errors.
        import torch
        sys.path.insert(0, str(musetalk))
        from musetalk.utils.audio_processor import AudioProcessor
        cls.torch = torch
        processor = AudioProcessor.__new__(AudioProcessor)
        encoder = SimpleNamespace(encoder=lambda features, output_hidden_states:
                                  SimpleNamespace(hidden_states=[torch.zeros(1, 1500, 1)]))
        backend = ModuleType("rorlig")
        backend.PAD_BEFORE_S, backend.PAD_AFTER_S, backend.FPS = 0.22, 0.53, 24
        backend.whisper_chunks = lambda samples: processor.get_whisper_chunk(
            [torch.zeros(1, 80, 3000)], "cpu", torch.float32, encoder, len(samples), fps=24)
        spec = importlib.util.spec_from_file_location("moving_motor_cpu_test", ROOT / "vendor/motor.py")
        cls.motor = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {"rorlig": backend}), patch.object(sys, "path", sys.path.copy()):
            spec.loader.exec_module(cls.motor)

    def avatar(self, take_count=60):
        avatar = self.motor.Avatar.__new__(self.motor.Avatar)
        avatar.info = {"vila": 7, "takes": {"deal": list(range(take_count))}}
        avatar.takes = avatar.info["takes"]
        return avatar

    def test_real_utterance_drains_hidden_lookbehind_and_propagates_its_failure(self):
        import numpy as np
        for fail_hidden in (False,True):
            with self.subTest(fail_hidden=fail_hidden):
                started,released,emitted=threading.Event(),threading.Event(),threading.Event()
                avatar=self.avatar(5)
                avatar.lat=self.torch.zeros(5,1)
                motor=self.motor.Motor.__new__(self.motor.Motor)
                motor.av={"dealer":avatar}
                def compose(_avatar,pool_index,*args):
                    if pool_index==1:  # fran=2 submits this neighbour but never emits it.
                        started.set()
                        if not released.wait(3): raise TimeoutError("test release missing")
                        if fail_hidden: raise ValueError("hidden_composition_failed")
                    return b"raw-yuv",[0,0,2,2]
                with ThreadPoolExecutor(max_workers=4) as pool, ThreadPoolExecutor(max_workers=1) as caller:
                    motor.pool=pool
                    with patch.object(self.motor,"audio_chunks",return_value=(np.zeros(5),self.torch.zeros(5,1))), \
                         patch.object(self.motor.R,"talvikt",return_value=np.ones(5),create=True), \
                         patch.object(self.motor.R,"ramp",return_value=1,create=True), \
                         patch.object(self.motor.R,"generate",side_effect=lambda lat,chunks:iter([np.zeros((2,2,3)) for _ in chunks]),create=True), \
                         patch.object(self.motor,"compose",side_effect=compose), \
                         patch.object(self.motor,"encode",return_value=b"h264"):
                        pending=caller.submit(motor.utterance,"dealer",b"pcm",24000,[["deal",0,5]],lambda *_:emitted.set(),2)
                        try:
                            self.assertTrue(started.wait(2))
                            self.assertTrue(emitted.wait(2))
                            with self.assertRaises(FutureTimeout): pending.result(timeout=.05)
                        finally:
                            released.set()
                        if fail_hidden:
                            with self.assertRaisesRegex(ValueError,"hidden_composition_failed"):
                                pending.result(timeout=2)
                        else:
                            self.assertEqual(pending.result(timeout=2)["rutor"],5)
                self.assertFalse(self.torch.cuda.is_initialized())

    def test_real_vendor_resolver_keeps_long_rest_and_exact_mixed_sources(self):
        avatar = self.avatar()
        self.assertEqual(avatar.resolve([["vila", 0, 42]], 42), [("vila", 0, 7)] * 42)
        self.assertEqual(avatar.resolve([["deal", 5, 2], ["vila", 0, 25]], 27),
                         [("deal", 5, 5), ("deal", 6, 6)] + [("vila", 0, 7)] * 25)
        with self.assertRaises(ValueError):
            avatar.resolve([["deal", 0, 42]], 43)
        with self.assertRaises(ValueError):
            avatar.resolve([["deal", 0, 42]], 41)

    def test_real_pcm_resampling_and_musetalk_chunks_agree_at_boundaries(self):
        # The encoder alone is synthetic. PCM, resampling, chunk selection and
        # MuseTalk's feature-frame extraction are the actual installed functions.
        for size, expected in [(25998, 30), (26000, 31), (26002, 31),
                               (63998, 49), (64000, 50), (64002, 50),
                               (53998, 44), (54000, 45), (54002, 45)]:
            with self.subTest(size=size):
                y, chunks = self.motor.audio_chunks(bytes(size), 24000)
                self.assertEqual(len(y), size // 2 + 18000)
                self.assertEqual(len(chunks), validate_pcm(bytes(size), expected, 0))
                self.assertEqual(chunks.device.type, "cpu")
        self.assertFalse(self.torch.cuda.is_initialized())

    def test_missing_audio_features_are_rejected_without_repeating_a_frame(self):
        with patch.object(self.motor.R, "whisper_chunks", return_value=self.torch.zeros(30, 1)):
            with self.assertRaisesRegex(ValueError, "incomplete_audio_features"):
                self.motor.audio_chunks(bytes(26000), 24000)

    def test_real_measurement_uses_an_explicit_complete_plan(self):
        engine = self.motor.Motor.__new__(self.motor.Motor)
        for count in (3, 130):
            avatar = self.avatar(count)
            engine.av = {"dealer": avatar}
            called = []
            def utterance(aid, pcm, rate, rows, emit):
                called.append(avatar.resolve(rows, pcm_frames(len(pcm), rate)))
                return {"forsta_bit_ms": 10, "rutor_per_s": 45.9}
            engine.utterance = utterance
            self.assertEqual(engine.measure("dealer")["rutor_per_s"], 45.9)
            self.assertEqual(len(called[0]), 90)
            if count == 3:
                self.assertEqual(called[0][3:], [("vila", 0, 7)] * 87)
