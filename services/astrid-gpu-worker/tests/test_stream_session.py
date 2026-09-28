import asyncio
import json
from pathlib import Path
import sys
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'workers'))
from stream_session import serve


class Socket:
    def __init__(self):
        self.input = asyncio.Queue()
        self.output = asyncio.Queue()

    async def send(self, value):
        await self.output.put(value)

    async def recv(self):
        value = await self.input.get()
        if isinstance(value, Exception):
            raise value
        return value

    async def put(self, value):
        await self.input.put(value if isinstance(value, bytes) else json.dumps(value))

    async def event(self, kind):
        while True:
            value = await asyncio.wait_for(self.output.get(), 3)
            if isinstance(value, str):
                value = json.loads(value)
                if value['t'] == kind:
                    return value


class FakeMuxer:
    def __init__(self, emit):
        self.emit = emit
        self.video = self
        self.audio = type('Sink', (), {'put': lambda _, value: None})()
        self.bytes = 0
        self.error = None
        self.closed = False

    def put(self, value):
        self.bytes += len(value)
        self.emit(value)

    def check(self): pass
    def finish(self): pass
    def close(self): self.closed = True


class SessionTests(unittest.IsolatedAsyncioTestCase):
    async def test_malformed_json_busy_and_invalid_pcm(self):
        ws = Socket()
        task = asyncio.create_task(serve(ws, 60, {}, None, None, None))
        await ws.event('pong')
        await ws.input.put('{')
        self.assertEqual((await ws.event('error'))['error'], 'invalid JSON message')
        await ws.put({'t': 'start', 'id': 'pending', 'rate': 24000, 'protocol': 2})
        await ws.event('stream')
        await ws.put({'t': 'start', 'id': 'busy', 'rate': 24000, 'protocol': 2})
        self.assertEqual((await ws.event('error'))['error'], 'worker is busy')
        await ws.put(b'x')
        error = await ws.event('error')
        self.assertEqual(error['id'], 'pending')
        self.assertIn('even byte count', error['error'])
        await ws.put({'t': 'ping'})
        await ws.event('pong')
        await ws.put({'t': 'bye'})
        await task

    async def test_incremental_abort_ack_then_reuse_and_legacy(self):
        ws = Socket()
        muxers = []

        def factory(rate, emit, cancelled):
            muxer = FakeMuxer(emit)
            muxers.append(muxer)
            return muxer

        def infer(pcm, rate, left, start, end, total):
            for frame in range(start, end):
                yield bytes([frame])

        def legacy(pcm, rate):
            self.assertEqual(len(pcm), 4800)
            return {'frames': 2, 'ms': {}}, b'legacy'

        task = asyncio.create_task(serve(ws, 60, {}, infer, factory, legacy))
        await ws.event('pong')
        await ws.put({'t': 'start', 'id': 'first', 'rate': 24000, 'protocol': 2})
        await ws.put(bytes(48000))
        await ws.event('stream')
        first = await asyncio.wait_for(ws.output.get(), 3)
        self.assertIsInstance(first, bytes, 'first media must precede end')
        await ws.put({'t': 'abort', 'id': 'first'})
        terminal = await ws.event('done')
        self.assertTrue(terminal['aborted'])
        self.assertTrue(muxers[0].closed, 'terminal ack must follow encoder cleanup')
        await ws.put({'t': 'start', 'id': 'second', 'rate': 24000, 'protocol': 2})
        await ws.put(bytes(4800))
        await ws.put({'t': 'end', 'id': 'second'})
        terminal = await ws.event('done')
        self.assertEqual(terminal['id'], 'second')
        self.assertEqual(terminal['frames'], 20)
        self.assertTrue(muxers[1].closed)
        await ws.put({'t': 'start', 'id': 'legacy', 'rate': 24000})
        await ws.put(bytes(4800))
        await ws.put({'t': 'end'})
        self.assertEqual((await ws.event('done'))['id'], 'legacy')
        self.assertEqual(await ws.output.get(), b'legacy')
        await ws.put({'t': 'bye'})
        self.assertEqual(await task, 'bye')

    async def test_disconnect_waits_for_inflight_model_and_closes_encoder(self):
        ws = Socket()
        entered, release = threading.Event(), threading.Event()
        muxers = []
        def factory(rate, emit, cancelled):
            muxer = FakeMuxer(emit); muxers.append(muxer); return muxer
        def infer(*args):
            entered.set()
            release.wait(3)
            yield b'late'
        task = asyncio.create_task(serve(ws, 60, {}, infer, factory, None))
        await ws.event('pong')
        await ws.put({'t': 'start', 'id': 'a', 'rate': 24000, 'protocol': 2})
        await ws.put(bytes(48000))
        self.assertTrue(await asyncio.to_thread(entered.wait, 3))
        await ws.input.put(ConnectionError('gone'))
        await asyncio.sleep(.05)
        self.assertFalse(task.done(), 'must not detach active model work')
        release.set()
        with self.assertRaises(ConnectionError):
            await asyncio.wait_for(task, 3)
        self.assertTrue(muxers[0].closed)
        remaining = []
        while not ws.output.empty():
            remaining.append(ws.output.get_nowait())
        self.assertFalse(any(isinstance(value, bytes) for value in remaining))


if __name__ == '__main__': unittest.main()
