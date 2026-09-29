import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'workers'))
from streaming import Cancelled, FragmentMuxer, Timeline, model_sample_count, render


class TimelineTests(unittest.TestCase):
    def test_encoder_starts_on_pcm_before_first_model_window(self):
        timeline = Timeline(24000)
        started = threading.Event()
        closed = threading.Event()
        errors = []

        class IdleMuxer:
            error = None
            def check(self): pass
            def close(self): closed.set()

        def factory(emit, cancelled):
            started.set()
            return IdleMuxer()

        def run():
            try:
                render(timeline, None, factory, lambda data: None)
            except Cancelled:
                pass
            except Exception as exc:
                errors.append(exc)

        thread = threading.Thread(target=run)
        thread.start()
        self.assertFalse(started.wait(.05), 'an empty utterance should not start FFmpeg')
        timeline.append(b'\x00\x00')
        self.assertTrue(started.wait(2), 'FFmpeg should start before the first model window')
        self.assertEqual(timeline.next_frame, 0)
        timeline.cancel()
        thread.join(2)
        self.assertFalse(thread.is_alive())
        self.assertTrue(closed.is_set())
        self.assertFalse(errors, str(errors))

    def test_inference_last_frame_does_not_round_down_twice(self):
        for frames in range(1, 100):
            samples = model_sample_count(frames)
            self.assertGreaterEqual(int(samples/16000*24), frames)
            self.assertLess(samples - frames*16000/24, 1)

    def test_context_and_samples_are_contiguous(self):
        for rate in (16000, 22050, 24000, 44100, 48000):
            t = Timeline(rate)
            source = bytes((i % 256 for i in range(rate * 2 * 3)))
            t.append(source)
            first = t.segment()
            self.assertIsNone(first[-1])
            t.finish()
            segments = [first]
            while (segment := t.segment()) is not None:
                segments.append(segment)
            output = b''.join(s[4] for s in segments)
            expected = bytes(t.pcm[:t.sample(segments[-1][1])*2])
            self.assertEqual(output, expected)
            for previous, following in zip(segments, segments[1:]):
                self.assertEqual(previous[1], following[0])
                self.assertEqual(following[2], max(0, following[0]-12))

    def test_validation_and_cancel(self):
        t = Timeline(24000)
        with self.assertRaises(ValueError): t.append(b'x')
        with self.assertRaises(ValueError): t.append(bytes(24000*2*26))
        with self.assertRaises(ValueError): t.finish()
        t.cancel()
        with self.assertRaises(Cancelled): t.segment()


@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'FFmpeg required')
class EncoderTests(unittest.TestCase):
    def test_failed_encoder_reports_without_waiting_for_end(self):
        timeline = Timeline(24000)
        errors, muxers = [], []
        def factory(emit, cancelled):
            muxer = FragmentMuxer(shutil.which('ffmpeg'), 'missing-base-file.yuv', 64, 64, 16, 16,
                0, 0, 24000, ['-c:v', 'libx264'], emit, cancelled)
            muxers.append(muxer)
            return muxer
        def infer(pcm, rate, left, start, end, total):
            for frame in range(start, end): yield bytes(16*16*4)
        def run():
            try: render(timeline, infer, factory, lambda data: None)
            except Exception as exc: errors.append(exc)
        thread = threading.Thread(target=run)
        thread.start()
        timeline.append(bytes(24000*2*3))
        thread.join(5)
        was_stuck = thread.is_alive()
        timeline.cancel(); thread.join(5)
        self.assertFalse(was_stuck, 'failed process must not block an input queue')
        self.assertTrue(errors)
        self.assertIsInstance(errors[0], RuntimeError)
        self.assertFalse(muxers[0].video.thread.is_alive())
        self.assertFalse(muxers[0].audio.thread.is_alive())

    def test_media_before_end_and_synchronized_tracks(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)/'base.yuv'
            base.write_bytes(bytes([80])*(64*64) + bytes([128])*(64*64//2))
            data = bytearray()
            media = threading.Event()
            errors, results = [], []
            timeline = Timeline(24000)

            def emit(chunk):
                data.extend(chunk)
                if b'moof' in data and b'mdat' in data:
                    media.set()

            def factory(emit, cancelled):
                return FragmentMuxer(shutil.which('ffmpeg'), str(base), 64, 64, 16, 16,
                    24, 24, 24000, ['-c:v', 'libx264', '-preset', 'ultrafast',
                                   '-tune', 'zerolatency', '-profile:v', 'high'], emit, cancelled)

            def infer(pcm, rate, left, start, end, total):
                for frame in range(start, end):
                    yield bytes([frame % 255, 0, 160, 180]) * 16*16

            def run():
                try: results.append(render(timeline, infer, factory, emit))
                except Exception as exc: errors.append(exc)

            thread = threading.Thread(target=run)
            thread.start()
            timeline.append(bytes(24000*2))
            early = media.wait(10)
            timeline.append(bytes(24000*2))
            timeline.finish()
            thread.join(15)
            if thread.is_alive():
                timeline.cancel(); thread.join(10)
            self.assertFalse(thread.is_alive(), 'encoder leaked a thread')
            self.assertFalse(errors, str(errors))
            self.assertTrue(early, 'no media fragment before end')
            output = Path(directory)/'stream.mp4'
            output.write_bytes(data)
            probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error',
                '-show_streams', '-show_packets', '-of', 'json', str(output)]))
            streams = probe['streams']
            self.assertEqual([s['codec_name'] for s in streams], ['h264', 'aac'])
            self.assertEqual(streams[0]['r_frame_rate'], '24/1')
            self.assertEqual(results[0]['frames'], 66)
            self.assertEqual(results[0]['encoder'], 'libx264')
            self.assertTrue(results[0]['encoder_verified'])
            self.assertIn('first_fragment', results[0]['ms'])
            self.assertIn('overlay_encode_wall', results[0]['ms'])
            self.assertEqual(streams[0]['profile'], 'High')
            self.assertEqual(streams[0]['level'], 42)
            ends = []
            for index in (0, 1):
                packets = [p for p in probe['packets'] if p['stream_index'] == index]
                times = [float(p['dts_time']) for p in packets]
                self.assertEqual(times, sorted(times))
                ends.append(max(float(p['pts_time'])+float(p.get('duration_time', 0)) for p in packets))
            self.assertLess(abs(ends[0]-ends[1]), .09)
            subprocess.run(['ffmpeg', '-v', 'error', '-i', str(output), '-f', 'null', '-'], check=True)

    def test_abort_cleans_live_encoder(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)/'base.yuv'
            base.write_bytes(bytes(64*64*3//2))
            cancel = threading.Event()
            encoder = FragmentMuxer(shutil.which('ffmpeg'), str(base), 64, 64, 16, 16,
                0, 0, 24000, ['-c:v', 'libx264'], lambda data: None, cancel)
            cancel.set()
            encoder.close()
            self.assertIsNotNone(encoder.proc.poll())
            self.assertFalse(encoder.video.thread.is_alive())
            self.assertFalse(encoder.audio.thread.is_alive())


if __name__ == '__main__':
    unittest.main()
