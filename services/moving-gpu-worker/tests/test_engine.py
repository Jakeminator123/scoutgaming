import asyncio
import os
from pathlib import Path
import sys
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import engine
import diagnostics as diag

def idle_worker(connection, bank_root, avatar):
    if hasattr(os,"setsid"):
        os.setsid()
    connection.send((0,"ready",{"rutor_per_s":45.9,"forsta_bit_ms":496}))
    while True:
        time.sleep(1)

def measured_worker(connection, bank_root, avatar):
    connection.send((0,"ready", {"rutor_per_s":45.9,"forsta_bit_ms":496,
                              "_diagnostics":{"warmupFps":45.9,"gpuName":"NVIDIA A40","callback":"private"}}))
    connection.recv()
    connection.send((0,{"t":"done","rutor":42,"_diagnostics":{"encodeMs":120,"renderMs":900,"nonce":"private"}},None))
    connection.close()


class SyntheticMotor:
    def measure(self, avatar):
        return {"rutor_per_s":39,"forsta_bit_ms":12}
    def utterance(self, avatar, pcm, rate, plan, emit, first):
        emit({"t":"lapp","source":plan[0],"fran":first},pcm)
        if pcm==b"fail-after-chunk":
            raise ValueError("hidden_composition_failed")
        return {"rutor":1,"ms":1,"rutor_per_s":1000}


def reusable_worker(connection, bank_root, avatar):
    if hasattr(os,"setsid"): os.setsid()
    try:
        engine.serve_engine(connection,SyntheticMotor(),avatar,
            SimpleNamespace(cuda=SimpleNamespace(is_initialized=lambda:False)),
            {"rutor_per_s":45,"forsta_bit_ms":20})
    except EOFError:
        pass
    finally:
        connection.close()


def stale_worker(connection, bank_root, avatar):
    connection.send((0,"ready",{"rutor_per_s":45}))
    connection.recv()
    connection.send((99,{"t":"done"},None))
    time.sleep(10)


def stalled_reuse_worker(connection, bank_root, avatar):
    if hasattr(os,"setsid"): os.setsid()
    connection.send((0,"ready",{"rutor_per_s":45}))
    connection.recv()
    connection.send((0,{"t":"done"},None))
    connection.recv()
    connection.send((0,"idle",None))
    connection.recv()
    time.sleep(60)

class OwnedProcess(unittest.IsolatedAsyncioTestCase):
    async def test_failed_utterance_never_reaches_reusable_idle(self):
        with patch.object(engine,"worker",reusable_worker):
            owned=engine.ProcessEngine("unused","dragan")
        try:
            await asyncio.wait_for(owned.prepare(),5)
            await owned.begin({"karta":[1],"fran_ruta":2},b"fail-after-chunk")
            self.assertEqual((await owned.next())[0]["t"],"lapp")
            with self.assertRaisesRegex(ValueError,"engine_generation_mismatch"):
                await owned.next()
            with self.assertRaisesRegex(ValueError,"engine_state_mismatch"):
                await owned.finish()
        finally:
            await owned.close()
        self.assertFalse(owned.process.is_alive())

    async def test_cancelled_reuse_prepare_is_reaped_before_new_process(self):
        with patch.object(engine,"worker",stalled_reuse_worker):
            owned=engine.ProcessEngine("unused","dragan")
        await asyncio.wait_for(owned.prepare(),5)
        await owned.begin({},b"pcm")
        await owned.next()
        await owned.finish()
        waiting=asyncio.create_task(owned.prepare())
        await asyncio.sleep(.02)
        waiting.cancel()
        with self.assertRaises(asyncio.CancelledError): await waiting
        await owned.close()
        self.assertFalse(owned.process.is_alive())
        self.assertTrue(owned.closed)
        with self.assertRaisesRegex(ValueError,"engine_state_mismatch"):
            await owned.prepare()

    async def test_two_distinct_utterances_share_process_but_not_payload_or_measurement(self):
        with patch.object(engine,"worker",reusable_worker):
            owned=engine.ProcessEngine("unused","dragan")
        pid=owned.process.pid
        try:
            for index in range(2):
                with diag.collect() as collector:
                    readiness=await asyncio.wait_for(owned.prepare(),5)
                    self.assertEqual(readiness["rutor_per_s"],45 if index==0 else 39)
                    payload=b"first-pcm" if index==0 else b"different-pcm"
                    await owned.begin({"karta":[index],"fran_ruta":index},payload)
                    self.assertEqual(await owned.next(),({"t":"lapp","source":index,"fran":index},payload))
                    self.assertEqual((await owned.next())[0]["t"],"done")
                    await asyncio.wait_for(owned.finish(),2)
                    self.assertEqual(owned.state,"idle")
                    self.assertIsNone(owned.measurement)
                    if index:
                        self.assertGreaterEqual(collector.snapshot()["warmupCheckMs"],0)
                        self.assertIsNone(collector.snapshot()["modelAvatarWarmupMs"])
                    self.assertEqual(owned.process.pid,pid)
        finally:
            await owned.close()
        self.assertFalse(owned.process.is_alive())

    async def test_stale_generation_is_rejected_and_cannot_be_finished(self):
        with patch.object(engine,"worker",stale_worker):
            owned=engine.ProcessEngine("unused","dragan")
        try:
            await asyncio.wait_for(owned.prepare(),5)
            await owned.begin({},b"pcm")
            with self.assertRaisesRegex(ValueError,"engine_generation_mismatch"):
                await owned.next()
            with self.assertRaisesRegex(ValueError,"engine_state_mismatch"):
                await owned.finish()
        finally:
            await owned.close()
        self.assertFalse(owned.process.is_alive())

    async def test_internal_diagnostics_never_reach_callback_metadata(self):
        with diag.collect() as collector, patch.object(engine,"worker",measured_worker):
            owned=engine.ProcessEngine("unused","dragan")
            try:
                self.assertEqual(await asyncio.wait_for(owned.prepare(),5),{"rutor_per_s":45.9,"forsta_bit_ms":496})
                await owned.begin({},b"synthetic")
                self.assertEqual(await asyncio.wait_for(owned.next(),5),({"t":"done","rutor":42},None))
                self.assertEqual(collector.snapshot()["gpuName"],"NVIDIA A40")
                self.assertEqual(collector.snapshot()["encodeMs"],120)
                self.assertNotIn("private",str(collector.snapshot()))
            finally:
                await owned.close()
            self.assertFalse(owned.process.is_alive())

    async def test_cancel_reaps_only_attempt_owned_process_and_prepare_is_cached(self):
        with patch.object(engine,"worker",idle_worker):
            owned=engine.ProcessEngine("unused","dragan")
        try:
            result=await asyncio.wait_for(owned.prepare(),5)
            self.assertEqual(result["rutor_per_s"],45.9)
            self.assertIs(await owned.prepare(),result)
            self.assertTrue(owned.process.is_alive())
        finally:
            await owned.close()
        self.assertFalse(owned.process.is_alive())
        await owned.close()
