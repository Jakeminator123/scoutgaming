import asyncio
import os
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import engine

def idle_worker(connection, bank_root, avatar):
    if hasattr(os,"setsid"):
        os.setsid()
    connection.send(("ready",{"rutor_per_s":45.9,"forsta_bit_ms":496}))
    while True:
        time.sleep(1)

class OwnedProcess(unittest.IsolatedAsyncioTestCase):
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
