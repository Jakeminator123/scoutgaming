import asyncio
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import serverless

class Serverless(unittest.IsolatedAsyncioTestCase):
    async def test_sdk_configuration_keeps_concurrency_one_without_starting_provider(self):
        captured=[]
        serverless.start(SimpleNamespace(serverless=SimpleNamespace(start=captured.append)))
        config=captured[0]
        self.assertIs(config["handler"],serverless.handler)
        self.assertTrue(all(config["concurrency_modifier"](current)==1 for current in (0,1,8)))

    async def test_async_sdk_handler_preserves_actual_provider_id_and_rejects_overlap(self):
        entered,release=asyncio.Event(),asyncio.Event()
        seen=[]
        async def run(job,store,origin):
            seen.append(job)
            entered.set()
            await release.wait()
            return "complete"
        with patch.object(serverless,"run",run):
            task=asyncio.create_task(serverless.handler({"id":"actual-id","input":{"valid":"input"},"policy":{}}))
            await entered.wait()
            second=await serverless.handler({"id":"second-id","input":{}})
            self.assertEqual(second,{"status":"failed","code":"worker_busy"})
            release.set()
            self.assertEqual(await task,{"status":"complete"})
        self.assertEqual(seen,[{"id":"actual-id","input":{"valid":"input"}}])

    async def test_cancellation_releases_only_own_admission_and_redacts_exceptions(self):
        async def cancelled(*args):
            raise asyncio.CancelledError()
        with patch.object(serverless,"run",cancelled):
            with self.assertRaises(asyncio.CancelledError):
                await serverless.handler({"id":"job","input":{}})
        async def failed(*args):
            raise ValueError("credential-bearing callback must not leak")
        with patch.object(serverless,"run",failed):
            result=await serverless.handler({"id":"job","input":{}})
            self.assertEqual(result,{"status":"failed","code":"moving_worker_failed"})
