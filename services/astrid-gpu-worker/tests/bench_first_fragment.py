#!/usr/bin/env python3
"""CPU-only FFmpeg first-fragment baseline; no model, network or paid service.

Run from any directory: python services/astrid-gpu-worker/tests/bench_first_fragment.py
This uses a tiny synthetic image and preloaded silence, so it measures the mux
path and metric distinction, not production lip sync or response latency.
"""
import argparse
import json
from pathlib import Path
import shutil
import statistics
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'workers'))
from streaming import FragmentMuxer, Timeline, render


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runs', type=int, default=5)
    args = parser.parse_args()
    if not 1 <= args.runs <= 100:
        parser.error('--runs must be between 1 and 100')
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        parser.error('FFmpeg is required')

    with tempfile.TemporaryDirectory(prefix='astrid-fragment-bench-') as directory:
        base = Path(directory) / 'base.yuv'
        base.write_bytes(bytes([80]) * (64 * 64) + bytes([128]) * (64 * 64 // 2))
        rows = []
        for _ in range(args.runs + 1):
            timeline = Timeline(24000)
            timeline.append(bytes(24000 * 2 * 2))
            timeline.finish()

            def infer(pcm, rate, left, start, end, total):
                for frame in range(start, end):
                    yield bytes([frame % 255, 80, 160, 180]) * (16 * 16)

            def muxer(emit, cancelled):
                return FragmentMuxer(ffmpeg, str(base), 64, 64, 16, 16,
                    24, 24, 24000, ['-c:v', 'libx264', '-preset', 'ultrafast',
                                    '-tune', 'zerolatency'], emit, cancelled)

            result = render(timeline, infer, muxer, lambda data: None)
            if not result['encoder_verified'] or 'first_fragment' not in result['ms']:
                raise RuntimeError('no complete encoded media fragment')
            rows.append(result['ms'])

    # First run warms the local executable and filesystem cache.
    measured = rows[1:]
    fields = ('first_output_byte', 'first_fragment', 'input_wait',
              'mux_backpressure', 'overlay_encode_wall', 'tot')
    print(json.dumps({
        'kind': 'cpu_synthetic_ffmpeg', 'runs': args.runs,
        'milliseconds': {field: {
            'median': statistics.median(row[field] for row in measured),
            'min': min(row[field] for row in measured),
            'max': max(row[field] for row in measured),
        } for field in fields},
        'init_to_media_median_ms': statistics.median(
            row['first_fragment'] - row['first_output_byte'] for row in measured),
    }, sort_keys=True))


if __name__ == '__main__':
    main()
