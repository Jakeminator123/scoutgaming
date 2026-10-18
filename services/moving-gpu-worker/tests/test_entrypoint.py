import asyncio
import contextlib
import io
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import diagnostics as diag
import entrypoint
from test_contracts import H, job


class RunDiagnostics(unittest.IsolatedAsyncioTestCase):
    def setup_run(self, stack, *, prepare=None, verify=None, connect=None):
        engine=SimpleNamespace(prepare=prepare or AsyncMock(return_value={}), close=AsyncMock())
        stack.enter_context(patch.object(entrypoint,"verify_release",return_value=H))
        stack.enter_context(patch.object(entrypoint,"verify_bank",verify or Mock(return_value={})))
        models=stack.enter_context(patch.object(entrypoint,"verify_models"))
        factory=stack.enter_context(patch.object(entrypoint,"ProcessEngine",return_value=engine))
        socket=SimpleNamespace(__aenter__=AsyncMock(return_value=object()),__aexit__=AsyncMock(return_value=False))
        class Connection:
            async def __aenter__(self): return await socket.__aenter__()
            async def __aexit__(self,*args): return await socket.__aexit__(*args)
        stack.enter_context(patch.dict(sys.modules,{"websockets":SimpleNamespace(connect=connect or Mock(return_value=Connection()))}))
        serve=stack.enter_context(patch.object(entrypoint,"serve",AsyncMock(return_value="complete")))
        return engine,models,factory,serve,socket

    async def test_valid_run_records_only_completed_stages_and_keeps_close_order(self):
        with contextlib.ExitStack() as stack, diag.collect() as collector:
            engine,models,factory,serve,socket=self.setup_run(stack)
            self.assertEqual(await entrypoint.run({"id":"actual","input":job()},"/unused","https://engine.example"),"complete")
            snapshot=collector.snapshot()
        self.assertEqual(snapshot["releaseSha256"],H)
        self.assertEqual(snapshot["bankArchiveCache"],"not_requested")
        for key in ("releaseVerifyMs","bankExtractVerifyMs","modelsVerifyMs","engineSpawnMs","enginePrepareMs","callbackConnectMs","engineStopMs"):
            self.assertGreaterEqual(snapshot[key],0,key)
        self.assertNotIn("engine.example",json.dumps(snapshot))
        self.assertEqual(engine.close.await_count,1)
        models.assert_called_once()
        serve.assert_awaited_once()
        socket.__aexit__.assert_awaited_once()

    async def test_failed_verification_does_not_load_models_or_hide_original_error(self):
        with contextlib.ExitStack() as stack, diag.collect() as collector:
            engine,models,factory,serve,socket=self.setup_run(stack,verify=Mock(side_effect=ValueError("bank_bytes_changed")))
            with self.assertRaisesRegex(ValueError,"bank_bytes_changed"):
                await entrypoint.run({"id":"actual","input":job()},"/unused","https://engine.example")
            snapshot=collector.snapshot()
        self.assertEqual(snapshot["firstFailedPhase"],"bankExtractVerifyMs")
        self.assertIsNone(snapshot["modelsVerifyMs"])
        models.assert_not_called()
        factory.assert_not_called()

    async def test_cancel_during_prepare_closes_engine_and_records_partial_phase(self):
        entered=asyncio.Event()
        async def prepare():
            entered.set()
            await asyncio.Future()
        with contextlib.ExitStack() as stack, diag.collect() as collector:
            engine,models,factory,serve,socket=self.setup_run(stack,prepare=prepare)
            task=asyncio.create_task(entrypoint.run({"id":"actual","input":job()},"/unused","https://engine.example"))
            await entered.wait()
            task.cancel()
            with self.assertRaises(asyncio.CancelledError): await task
            snapshot=collector.snapshot()
        self.assertEqual(snapshot["firstFailedPhase"],"enginePrepareMs")
        self.assertGreaterEqual(snapshot["enginePrepareMs"],0)
        self.assertGreaterEqual(snapshot["engineStopMs"],0)
        engine.close.assert_awaited_once()
        serve.assert_not_awaited()

    async def test_connection_failure_is_timed_and_always_closes_owned_engine(self):
        with contextlib.ExitStack() as stack, diag.collect() as collector:
            engine,models,factory,serve,socket=self.setup_run(stack,connect=Mock(side_effect=OSError("private callback")))
            with self.assertRaises(OSError):
                await entrypoint.run({"id":"actual","input":job()},"/unused","https://engine.example")
            snapshot=collector.snapshot()
        self.assertEqual(snapshot["firstFailedPhase"],"callbackConnectMs")
        self.assertGreaterEqual(snapshot["callbackConnectMs"],0)
        engine.close.assert_awaited_once()
        self.assertNotIn("private",json.dumps(snapshot))


class HandlerDiagnostics(unittest.TestCase):
    def test_cli_failure_reports_fixed_code_and_safe_partial_timings(self):
        async def failed(*args):
            with diag.phase("modelsVerifyMs"):
                raise ValueError("https://private?token=secret")
        output=io.StringIO()
        with patch.object(entrypoint,"run",failed),patch.object(sys,"stderr",output):
            result=entrypoint.handler({"id":"private-job","input":{"token":"secret"}})
        self.assertEqual(result["status"],"failed")
        self.assertEqual(result["code"],"moving_worker_failed")
        self.assertEqual(result["diagnostics"]["firstFailedPhase"],"modelsVerifyMs")
        self.assertEqual(result["diagnostics"],json.loads(output.getvalue())["diagnostics"])
        self.assertNotIn("private",output.getvalue()+json.dumps(result))
