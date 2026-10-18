import asyncio
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import AsyncMock, Mock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from engine_cache import EngineCache
from test_contracts import binding


class Model:
    def __init__(self):
        self.closed=False
        self.finish=AsyncMock()
    async def close(self):
        self.closed=True
    def close_sync(self):
        self.closed=True


class ModelLeases(unittest.IsolatedAsyncioTestCase):
    async def test_repeated_cancel_after_process_death_releases_temp_and_admission(self):
        cache=EngineCache()
        model=Model()
        async def close():
            model.closed=True
            raise asyncio.CancelledError()
        model.close=close
        temporary=tempfile.TemporaryDirectory()
        path=Path(temporary.name)
        await cache.acquire(binding(),temporary,lambda:model)
        with self.assertRaises(asyncio.CancelledError): await cache.close()
        self.assertIsNone(cache.engine)
        self.assertIsNone(cache.active)
        self.assertFalse(path.exists())

    async def test_only_finished_lease_reuses_one_model_and_original_directory(self):
        cache=EngineCache()
        temporary=tempfile.TemporaryDirectory()
        path=Path(temporary.name)
        model=Model()
        factory=Mock(return_value=model)
        first=await cache.acquire(binding(),temporary,factory)
        self.assertTrue(first.retained_temporary)
        with tempfile.TemporaryDirectory() as unused:
            with self.assertRaisesRegex(ValueError,"engine_lease_busy"):
                await cache.acquire(binding(),unused,factory)
        await first.finish()
        with tempfile.TemporaryDirectory() as scratch:
            second=await cache.acquire(binding(),scratch,factory)
            self.assertFalse(second.retained_temporary)
            self.assertIs(cache.engine,model)
            self.assertTrue(path.exists())
            factory.assert_called_once()
            with self.assertRaisesRegex(ValueError,"engine_lease_inactive"):
                await first.prepare()
            await second.close()
        self.assertTrue(model.closed)
        self.assertFalse(path.exists())
        self.assertIsNone(cache.engine)

    async def test_each_binding_change_stops_old_model_before_replacement(self):
        for field in ("releaseSha256","avatarSha256","bankReceiptSha256","sourceSetSha256","profileRevision","dealerId","workerAvatar"):
            with self.subTest(field=field):
                cache=EngineCache()
                old=Model()
                temporary=tempfile.TemporaryDirectory()
                path=Path(temporary.name)
                lease=await cache.acquire(binding(),temporary,lambda:old)
                await lease.finish()
                changed=binding()
                changed[field]="new" if field in ("dealerId","workerAvatar") else "f"*64
                await cache.check(changed)
                self.assertTrue(old.closed)
                self.assertFalse(path.exists())
                self.assertIsNone(cache.engine)

    async def test_finish_failure_never_releases_lease_and_shutdown_cleans_bank(self):
        cache=EngineCache()
        model=Model()
        model.finish.side_effect=ValueError("engine_generation_mismatch")
        temporary=tempfile.TemporaryDirectory()
        path=Path(temporary.name)
        lease=await cache.acquire(binding(),temporary,lambda:model)
        with self.assertRaises(ValueError): await lease.finish()
        self.assertIs(cache.active,lease)
        await cache.close()
        self.assertFalse(path.exists())
        self.assertTrue(model.closed)

    async def test_failed_process_stop_retains_ownership_for_retry(self):
        cache=EngineCache()
        model=Model()
        model.close=AsyncMock(side_effect=RuntimeError("owned_engine_did_not_stop"))
        temporary=tempfile.TemporaryDirectory()
        path=Path(temporary.name)
        lease=await cache.acquire(binding(),temporary,lambda:model)
        with self.assertRaises(RuntimeError): await cache.close()
        self.assertTrue(path.exists())
        self.assertIs(cache.active,lease)
        self.assertIs(cache.engine,model)
        cache.close_sync()
        self.assertFalse(path.exists())
