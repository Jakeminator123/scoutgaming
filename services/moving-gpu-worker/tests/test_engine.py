import asyncio
import os
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import engine
import diagnostics as diag

def idle_worker(connection, bank_root, avatar):
    if hasattr(os,"setsid"):
        os.setsid()
    connection.send(("ready",{"rutor_per_s":45.9,"forsta_bit_ms":496}))
    while True:
        time.sleep(1)

def measured_worker(connection, bank_root, avatar):
    connection.send(("ready", {"rutor_per_s":45.9,"forsta_bit_ms":496,
                              "_diagnostics":{"warmupFps":45.9,"gpuName":"NVIDIA A40","callback":"private"}}))
    connection.recv()
    connection.send(({"t":"done","rutor":42,"_diagnostics":{"encodeMs":120,"renderMs":900,"nonce":"private"}},None))
    connection.close()

class OwnedProcess(unittest.IsolatedAsyncioTestCase):
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
