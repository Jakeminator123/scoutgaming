"""One SDK-owned model and extracted bank, never a cache of utterances."""
import asyncio
import diagnostics as diag

KEY_FIELDS = ("releaseSha256", "dealerId", "workerAvatar", "profileRevision",
              "avatarSha256", "bankReceiptSha256", "sourceSetSha256")


class EngineCache:
    def __init__(self):
        self.engine = self.temporary = self.key = self.active = None

    async def check(self, binding):
        if self.active is not None:
            raise ValueError("engine_lease_busy")
        key = tuple(binding[name] for name in KEY_FIELDS)
        if self.engine is not None and (self.key != key or self.engine.closed):
            await self.close()
        return key

    async def acquire(self, binding, temporary, factory):
        key = await self.check(binding)
        retained = self.engine is None
        if retained:
            with diag.phase("engineSpawnMs"):
                self.engine = factory()
            self.temporary, self.key = temporary, key
        diag.record(modelCache="miss" if retained else "hit")
        lease = Lease(self, retained)
        self.active = lease
        return lease

    async def close(self):
        if self.engine is not None:
            # Do not discard ownership or the bank while a process might live.
            try:
                with diag.phase("engineStopMs"):
                    await self.engine.close()
            except BaseException:
                # ProcessEngine waits for death even under repeated cancellation.
                # Propagate cancellation, but don't strand a dead active lease.
                if self.engine.closed:
                    self._discard()
                raise
        self._discard()

    def close_sync(self):
        if self.engine is not None:
            self.engine.close_sync()
        self._discard()

    def _discard(self):
        if self.temporary is not None:
            self.temporary.cleanup()
        self.engine = self.temporary = self.key = self.active = None


class Lease:
    def __init__(self, owner, retained_temporary):
        self.owner = owner
        self.retained_temporary = retained_temporary

    def _engine(self):
        if self.owner.active is not self:
            raise ValueError("engine_lease_inactive")
        return self.owner.engine

    async def prepare(self):
        return await self._engine().prepare()

    async def begin(self, start, pcm):
        return await self._engine().begin(start, pcm)

    async def next(self):
        return await self._engine().next()

    async def finish(self):
        # Internal idle acknowledgement is bounded by both this timeout and the
        # caller's job deadline. Only the owner can return a fully drained lease.
        await asyncio.wait_for(self._engine().finish(), 5)
        self.owner.active = None

    async def close(self):
        if self.owner.active is self:
            await self.owner.close()
