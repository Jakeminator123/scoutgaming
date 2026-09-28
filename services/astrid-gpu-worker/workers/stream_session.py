"""Reverse WebSocket session with cancellable v2 streaming and v1 compatibility."""
import asyncio
import concurrent.futures
import json
import time

from streaming import Cancelled, MIME, Timeline, render


async def serve(ws, ttl, metadata, infer, muxer_factory, legacy, before=.22, after=.53):
    loop = asyncio.get_running_loop()
    current = None
    deadline = time.monotonic() + ttl
    tasks = set()

    async def send(payload):
        await asyncio.wait_for(ws.send(json.dumps(payload)), 15)

    async def pong():
        await send({'t': 'pong', 'ready': True, 'protocols': [1, 2], **metadata})

    async def execute(job):
        nonlocal current
        timeline = job['timeline']

        def emit(data):
            if timeline.cancelled.is_set():
                raise Cancelled()
            # One outstanding send: network congestion backpressures FFmpeg.
            future = asyncio.run_coroutine_threadsafe(ws.send(data), loop)
            try:
                future.result(timeout=15)
            except concurrent.futures.TimeoutError:
                future.cancel()
                raise TimeoutError('video receiver is too slow')

        try:
            if job['protocol'] == 2:
                await send({'t': 'stream', 'id': job['id'], 'mime': MIME})
                result = await asyncio.to_thread(render, timeline, infer,
                    lambda emit, cancelled: muxer_factory(timeline.rate, emit, cancelled), emit)
                if timeline.cancelled.is_set():
                    raise Cancelled()
                current = None
                await send({'t': 'done', 'id': job['id'], **result})
            else:
                result, data = await asyncio.to_thread(legacy, bytes(timeline.pcm[timeline.before*2:]), timeline.rate)
                if timeline.cancelled.is_set():
                    raise Cancelled()
                await send({'t': 'done', 'id': job['id'], **result})
                await asyncio.wait_for(ws.send(data), 15)
                current = None
        except Cancelled:
            current = None
            if job.get('failure'):
                await send({'t': 'error', 'id': job['id'], 'error': job['failure'], 'reason': job['failure']})
            else:
                await send({'t': 'done', 'id': job['id'], 'aborted': True, 'frames': 0, 'ms': {}})
        except Exception as exc:
            timeline.cancel()
            current = None
            await send({'t': 'error', 'id': job['id'], 'error': str(exc)[:300], 'reason': str(exc)[:300]})

    def launch(job):
        task = asyncio.create_task(execute(job))
        tasks.add(task)
        def completed(task):
            tasks.discard(task)
            # A peer may disconnect while its terminal event is being sent.
            # Retrieve task exceptions even if it completed before final gather.
            if not task.cancelled():
                task.exception()
        task.add_done_callback(completed)
        job['task'] = task

    await pong()
    reason = 'ttl'
    try:
        while time.monotonic() < deadline or (current and time.monotonic() < deadline + 45):
            try:
                message = await asyncio.wait_for(ws.recv(), .5)
            except asyncio.TimeoutError:
                continue
            if isinstance(message, bytes):
                if current:
                    try:
                        current['timeline'].append(message)
                    except ValueError as exc:
                        current['failure'] = str(exc)
                        current['timeline'].cancel()
                        if not current.get('task'):
                            await send({'t': 'error', 'id': current['id'], 'error': str(exc), 'reason': str(exc)})
                            current = None
                continue
            try:
                payload = json.loads(message)
                kind = payload.get('t')
            except (ValueError, AttributeError):
                await send({'t': 'error', 'error': 'invalid JSON message'})
                continue
            if kind == 'ping':
                await pong()
            elif kind == 'bye':
                reason = 'bye'
                break
            elif kind == 'start':
                if current:
                    await send({'t': 'error', 'id': payload.get('id'), 'error': 'worker is busy'})
                    continue
                try:
                    protocol = payload.get('protocol', 1)
                    if protocol not in (1, 2):
                        raise ValueError('unsupported protocol')
                    if not isinstance(payload.get('id'), str) or not 1 <= len(payload['id']) <= 128:
                        raise ValueError('id must be a nonempty string of at most 128 characters')
                    timeline = Timeline(payload.get('rate', 24000), before if protocol == 2 else 0,
                                        after if protocol == 2 else 0)
                    current = {'id': payload['id'], 'protocol': protocol, 'timeline': timeline}
                    if protocol == 2:
                        launch(current)
                except ValueError as exc:
                    await send({'t': 'error', 'id': payload.get('id'), 'error': str(exc)})
            elif kind in ('end', 'abort') and current:
                if payload.get('id', current['id']) != current['id']:
                    await send({'t': 'error', 'id': payload.get('id'), 'error': 'utterance id mismatch'})
                    continue
                if kind == 'abort':
                    current['timeline'].cancel()
                    if not current.get('task'):
                        await send({'t': 'done', 'id': current['id'], 'aborted': True, 'frames': 0, 'ms': {}})
                        current = None
                else:
                    try:
                        current['timeline'].finish()
                        if current['protocol'] == 1:
                            launch(current)
                    except ValueError as exc:
                        current['failure'] = str(exc)
                        current['timeline'].cancel()
                        if not current.get('task'):
                            await send({'t': 'error', 'id': current['id'], 'error': str(exc)})
                            current = None
    finally:
        if current:
            current['timeline'].cancel()
        # Do not detach model/encoder work and reuse GPU while it is still running.
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    return reason
