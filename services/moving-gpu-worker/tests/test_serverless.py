import asyncio
import io
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import serverless
import diagnostics as diag

class Serverless(unittest.IsolatedAsyncioTestCase):
    def assert_result(self, result, expected):
        self.assertEqual({key:value for key,value in result.items() if key != "diagnostics"}, expected)
        self.assertEqual(result["diagnostics"]["schemaVersion"], 1)
        self.assertEqual(result["diagnostics"]["outcome"], expected["status"])

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
            self.assert_result(await task,{"status":"complete"})
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
            self.assert_result(result,{"status":"failed","code":"moving_worker_failed"})

    async def test_known_download_failure_is_observable_and_releases_admission(self):
        for code in ("bank_http_rejected", "bank_length_mismatch", "bank_bytes_changed",
                     "bank_cache_conflict", "invalid_bank_origin", "release_mismatch"):
            with self.subTest(code=code):
                async def failed(*args):
                    raise ValueError(code)
                with patch.object(serverless, "run", failed):
                    self.assert_result(await serverless.handler({"id":"job", "input":{}}),
                                     {"status":"failed", "code":code})
        async def complete(*args):
            return "complete"
        with patch.object(serverless, "run", complete):
            self.assert_result(await serverless.handler({"id":"next", "input":{}}),
                             {"status":"complete"})

    async def test_unknown_messages_and_lookalike_codes_remain_redacted(self):
        class Lookalike(ValueError):
            def __str__(self):
                raise AssertionError("exception must not be formatted")
        for error in (ValueError("bank_http_rejected?token=private"),
                      ValueError("bank_length_mismatch", "private callback"),
                      ValueError({"token":"private"}),
                      RuntimeError("bank_bytes_changed"),
                      Lookalike("bank_length_mismatch")):
            with self.subTest(kind=type(error).__name__):
                async def failed(*args):
                    raise error
                with patch.object(serverless, "run", failed):
                    self.assert_result(await serverless.handler({"id":"job", "input":{}}),
                                     {"status":"failed", "code":"moving_worker_failed"})

    async def test_io_and_timeout_categories_do_not_expose_messages(self):
        for error, code in ((TimeoutError("private callback"), "moving_worker_timeout"),
                            (FileNotFoundError("private path"), "moving_worker_io_failed")):
            with self.subTest(code=code):
                async def failed(*args):
                    raise error
                with patch.object(serverless, "run", failed):
                    self.assert_result(await serverless.handler({"id":"job", "input":{}}),
                                     {"status":"failed", "code":code})

    async def test_each_result_and_cancel_log_is_bound_to_own_sanitized_collector(self):
        async def completed(*args):
            diag.record(releaseSha256="a" * 64, bankArchiveCache="hit", warmupFps=33, callbackUrl="private")
            return "complete"
        output=io.StringIO()
        with patch.object(serverless,"run",completed), patch.object(sys,"stderr",output):
            result=await serverless.handler({"id":"private-job","input":{"token":"private"}})
        logged=json.loads(output.getvalue())["diagnostics"]
        self.assertEqual(result["diagnostics"],logged)
        self.assertEqual(logged["releaseSha256"],"a"*64)
        self.assertEqual(logged["warmupFps"],33)
        self.assertNotIn("private",json.dumps(result)+output.getvalue())
        async def cancelled(*args):
            with diag.phase("enginePrepareMs"):
                raise asyncio.CancelledError()
        output=io.StringIO()
        with patch.object(serverless,"run",cancelled),patch.object(sys,"stderr",output):
            with self.assertRaises(asyncio.CancelledError):
                await serverless.handler({"id":"job","input":{}})
        cancelled=json.loads(output.getvalue())["diagnostics"]
        self.assertEqual(cancelled["outcome"],"cancelled")
        self.assertEqual(cancelled["firstFailedPhase"],"enginePrepareMs")
        self.assertIsNone(cancelled["releaseSha256"])
        self.assertFalse(serverless._ADMISSION.locked())
