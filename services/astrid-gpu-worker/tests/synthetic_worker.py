#!/usr/bin/env python3
"""Loopback-only browser fixture using the real worker session and FFmpeg muxer.

No GPU/model is loaded. It proves transport, decode, timestamps and lifecycle,
not facial quality or GPU performance. Credentials are read from an environment
variable and never printed. Send {"t":"bye"}, close the socket, or SIGTERM to
release the temporary base image and any active encoder.
"""
import argparse
import asyncio
import inspect
import json
import os
from pathlib import Path
import shutil
import signal
import sys
import tempfile
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'workers'))
from stream_session import serve
from streaming import FragmentMuxer


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--token-env', default='LIPSYNC_WORKER_TOKEN')
    parser.add_argument('--worker-id', default='synthetic-e2e')
    parser.add_argument('--ttl', type=int, default=120)
    parser.add_argument('--ffmpeg', default=shutil.which('ffmpeg'))
    args = parser.parse_args()
    parsed = urlsplit(args.url)
    if parsed.scheme not in ('ws', 'wss') or parsed.hostname not in ('127.0.0.1', 'localhost', '::1'):
        parser.error('--url must target a loopback WebSocket')
    if parsed.username or parsed.password or parsed.query:
        parser.error('use the token environment variable, not URL credentials')
    if not args.ffmpeg:
        parser.error('FFmpeg not found; use --ffmpeg')
    if not 1 <= args.ttl <= 300:
        parser.error('--ttl must be between 1 and 300 seconds')
    if not os.environ.get(args.token_env):
        parser.error('worker token environment variable is empty')
    return args


async def run(args):
    import websockets
    with tempfile.TemporaryDirectory(prefix='synthetic-lipsync-') as directory:
        base = Path(directory) / 'base.yuv'
        base.write_bytes(bytes([80])*(64*64) + bytes([128])*(64*64//2))

        def muxer(rate, emit, cancelled):
            return FragmentMuxer(args.ffmpeg, str(base), 64, 64, 16, 16, 24, 24, rate,
                ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency'], emit, cancelled)

        def infer(pcm, rate, left, start, end, total):
            # An obvious moving color, not a person or a lip-sync quality proxy.
            for frame in range(start, end):
                yield bytes([(frame*11) % 256, 80, 180, 220]) * 16*16

        def legacy(pcm, rate):
            raise ValueError('synthetic browser fixture requires protocol 2')

        headers = {'Authorization': 'Bearer ' + os.environ[args.token_env],
                   'X-Worker-Id': args.worker_id}
        header_arg = 'additional_headers' if 'additional_headers' in inspect.signature(websockets.connect).parameters else 'extra_headers'
        async with websockets.connect(args.url, max_size=1024*1024, max_queue=8,
                                      **{header_arg: headers}) as ws:
            loop = asyncio.get_running_loop()
            previous_signals = {}

            def stop(signum, frame):
                loop.call_soon_threadsafe(lambda: asyncio.create_task(ws.close()))

            for signum in (signal.SIGINT, signal.SIGTERM):
                previous_signals[signum] = signal.signal(signum, stop)
            print(json.dumps({'synthetic': True, 'status': 'connected'}), flush=True)
            try:
                reason = await serve(ws, args.ttl, {'synthetic': True, 'avatar': 'synthetic',
                    'encoder': 'libx264-session', 'polish': False, 'session': True}, infer, muxer, legacy)
            except websockets.ConnectionClosed:
                reason = 'closed'
            finally:
                for signum, previous in previous_signals.items():
                    signal.signal(signum, previous)
            print(json.dumps({'synthetic': True, 'status': 'stopped', 'reason': reason}), flush=True)


if __name__ == '__main__':
    try:
        asyncio.run(run(parse_args()))
    except Exception as exc:
        # Exception messages from network libraries may contain credential URLs.
        print(json.dumps({'synthetic': True, 'error': type(exc).__name__}), file=sys.stderr)
        sys.exit(1)
