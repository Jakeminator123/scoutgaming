"""Bounded incremental PCM timeline and continuous fMP4 muxer; no model dependencies.

Audio windows overlap for model context. Only their central video frames are
emitted; PCM is emitted once, on the same global frame/sample timeline.
"""
import queue
import socket
import subprocess
import threading
import time

MIME = 'video/mp4; codecs="avc1.64002a, mp4a.40.2"'
FPS = 24
MAX_SECONDS = 25


def model_sample_count(frames, rate=16000):
    """Ceil for inference only; emitted PCM uses the floor boundary in Timeline.

    At 16 kHz one video frame is 666 2/3 samples. A floor-truncated last window
    would make Whisper floor its frame count a second time and lose a frame.
    """
    return (frames * rate + FPS - 1) // FPS


class Cancelled(Exception):
    pass


class Timeline:
    def __init__(self, rate, before=.22, after=.53, block=12, context=12):
        if type(rate) is not int or rate not in (16000, 22050, 24000, 44100, 48000):
            raise ValueError("unsupported PCM sample rate")
        self.rate, self.block, self.context = rate, block, context
        self.before, self.after = int(before * rate), int(after * rate)
        self.pcm = bytearray(self.before * 2)
        self.received = 0
        self.ended = False
        self.cancelled = threading.Event()
        self.condition = threading.Condition()
        self.next_frame = 0

    def append(self, pcm):
        with self.condition:
            if self.ended or self.cancelled.is_set():
                raise ValueError("utterance is closed")
            if len(pcm) % 2:
                raise ValueError("PCM16 chunks must have an even byte count")
            if self.received + len(pcm) > self.rate * 2 * MAX_SECONDS:
                raise ValueError("utterance exceeds 25 seconds")
            self.pcm.extend(pcm)
            self.received += len(pcm)
            self.condition.notify_all()

    def finish(self):
        with self.condition:
            if self.ended:
                raise ValueError("duplicate end")
            if not self.received:
                raise ValueError("empty utterance")
            self.pcm.extend(bytes(self.after * 2))
            self.ended = True
            self.condition.notify_all()

    def cancel(self):
        self.cancelled.set()
        with self.condition:
            self.condition.notify_all()

    def sample(self, frame):
        return frame * self.rate // FPS

    def segment(self, check=None):
        with self.condition:
            while True:
                if self.cancelled.is_set():
                    raise Cancelled()
                if check:
                    check()
                total = (len(self.pcm) // 2) * FPS // self.rate
                start = self.next_frame
                if self.ended and start >= total:
                    return None
                end = min(start + self.block, total) if self.ended else start + self.block
                if self.ended or total >= end + self.context:
                    left = max(0, start - self.context)
                    right = min(total, end + self.context)
                    window = bytes(self.pcm[self.sample(left)*2:self.sample(right)*2])
                    audio = bytes(self.pcm[self.sample(start)*2:self.sample(end)*2])
                    self.next_frame = end
                    return start, end, left, window, audio, total if self.ended else None
                self.condition.wait(.2)


class _Input:
    """Bounded FIFO feeding one local FFmpeg TCP input; cancellation closes sockets."""
    def __init__(self, cancelled):
        self.cancelled = cancelled
        self.stopped = threading.Event()
        self.queue = queue.Queue(24)
        self.error = None
        self.check = None
        self.connection = None
        self.listener = socket.socket()
        self.listener.bind(('127.0.0.1', 0))
        self.listener.listen(1)
        self.listener.settimeout(.2)
        self.url = 'tcp://127.0.0.1:%d' % self.listener.getsockname()[1]
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()

    def put(self, data):
        while not self.cancelled.is_set() and not self.stopped.is_set():
            if self.error:
                raise self.error
            if self.check:
                self.check()
            try:
                self.queue.put(data, timeout=.2)
                return
            except queue.Full:
                pass
        raise Cancelled()

    def run(self):
        try:
            while not self.cancelled.is_set() and not self.stopped.is_set():
                try:
                    self.connection, _ = self.listener.accept()
                    break
                except socket.timeout:
                    pass
            if self.connection is None:
                return
            # Blocking writes are interrupted by shutdown() on cancel.
            self.connection.settimeout(None)
            while not self.cancelled.is_set() and not self.stopped.is_set():
                try:
                    data = self.queue.get(timeout=.2)
                except queue.Empty:
                    continue
                if data is None:
                    break
                self.connection.sendall(data)
        except Exception as exc:
            if not self.cancelled.is_set():
                self.error = exc
        finally:
            self.close()

    def close(self):
        self.stopped.set()
        for sock in (self.connection, self.listener):
            if sock is not None:
                try:
                    sock.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
                sock.close()


class FragmentMuxer:
    def __init__(self, ffmpeg, base_yuv, width, height, crop_width, crop_height,
                 x, y, rate, encoder_args, emit, cancelled, max_bytes=128*1024*1024):
        self.cancelled, self.emit = cancelled, emit
        self.video, self.audio = _Input(cancelled), _Input(cancelled)
        self.error = None
        self.bytes = 0
        self.stderr = bytearray()
        self.proc = None
        if 'libx264' in encoder_args:
            # ultrafast otherwise writes Constrained Baseline despite -profile high.
            encoder_args = [*encoder_args, '-x264-params', '8x8dct=1:cabac=1']
        common = ['-thread_queue_size', '64', '-probesize', '32', '-analyzeduration', '0', '-avioflags', 'direct']
        cmd = [ffmpeg, '-hide_banner', '-v', 'error', '-nostdin', '-filter_complex_threads', '1',
               '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', f'{width}x{height}',
               '-r', str(FPS), '-color_range', 'tv', '-colorspace', 'bt709',
               '-stream_loop', '-1', '-i', base_yuv,
               *common, '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', f'{crop_width}x{crop_height}',
               '-r', str(FPS), '-i', self.video.url,
               *common, '-f', 's16le', '-ar', str(rate), '-ac', '1', '-i', self.audio.url,
               '-filter_complex', f'[1:v]scale=out_color_matrix=bt709:out_range=tv,format=yuva420p[f];[0:v][f]overlay={x}:{y}:shortest=1:format=yuv420[v]',
               '-map', '[v]', '-map', '2:a', '-pix_fmt', 'yuv420p',
               '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-color_range', 'tv',
               *encoder_args, '-bf', '0', '-g', '6', '-keyint_min', '6', '-sc_threshold', '0', '-profile:v', 'high', '-level:v', '4.2',
               '-c:a', 'aac', '-b:a', '96k', '-max_interleave_delta', '100000',
               '-movflags', '+empty_moov+default_base_moof+frag_keyframe',
               '-flush_packets', '1', '-f', 'mp4', 'pipe:1']
        try:
            self.proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except Exception:
            self.video.close(); self.audio.close()
            raise

        def output():
            try:
                while not cancelled.is_set():
                    data = self.proc.stdout.read1(65536)
                    if not data:
                        break
                    self.bytes += len(data)
                    if self.bytes > max_bytes:
                        raise ValueError('encoded output limit exceeded')
                    emit(data)
            except Exception as exc:
                self.error = exc
                cancelled.set()
                self.stop()

        def errors():
            while True:
                data = self.proc.stderr.read(1024)
                if not data:
                    break
                self.stderr.extend(data)
                del self.stderr[:-4096]

        self.reader = threading.Thread(target=output, daemon=True)
        self.err_reader = threading.Thread(target=errors, daemon=True)
        self.reader.start(); self.err_reader.start()
        self.video.check = self.audio.check = self.check

    def check(self):
        if self.error:
            raise self.error
        if self.proc.poll() is not None:
            raise RuntimeError('FFmpeg exited before input completed: ' + self.stderr.decode(errors='replace')[-1000:])

    def stop(self):
        self.video.close(); self.audio.close()
        if self.proc and self.proc.poll() is None:
            self.proc.kill()

    def finish(self):
        self.video.put(None); self.audio.put(None)
        deadline = time.monotonic() + 30
        while self.proc.poll() is None:
            if self.cancelled.is_set():
                raise self.error or Cancelled()
            if time.monotonic() > deadline:
                raise TimeoutError('FFmpeg drain timed out')
            time.sleep(.02)
        while self.reader.is_alive() or self.err_reader.is_alive():
            if self.cancelled.is_set():
                raise self.error or Cancelled()
            if time.monotonic() > deadline:
                raise TimeoutError('encoded output drain timed out')
            self.reader.join(.05); self.err_reader.join(.05)
        if self.error:
            raise self.error
        if self.proc.returncode:
            raise RuntimeError('FFmpeg: ' + self.stderr.decode(errors='replace')[-1000:])

    def close(self):
        self.stop()
        if self.proc:
            self.proc.wait(timeout=5)
        for thread in (self.video.thread, self.audio.thread, self.reader, self.err_reader):
            if thread is not threading.current_thread():
                thread.join(16)
        if self.proc:
            self.proc.stdout.close(); self.proc.stderr.close()


def render(timeline, infer, muxer_factory, emit):
    """infer(window PCM, rate, first frame in window, global start/end, total)
    yields exactly end-start BGRA crops. Model calls are made on this one thread.
    """
    muxer = None
    frames = 0
    started = time.monotonic()
    try:
        while True:
            segment = timeline.segment(muxer.check if muxer else None)
            if segment is None:
                break
            start, end, left, window, audio, total = segment
            if muxer is None:
                muxer = muxer_factory(emit, timeline.cancelled)
            muxer.audio.put(audio)
            count = 0
            for crop in infer(window, timeline.rate, left, start, end, total):
                if timeline.cancelled.is_set():
                    raise Cancelled()
                muxer.video.put(crop)
                count += 1
            if count != end-start:
                raise RuntimeError(f'model returned {count} frames, expected {end-start}')
            frames += count
        if muxer:
            muxer.finish()
        return {'frames': frames, 'ms': {'tot': round((time.monotonic()-started)*1000)},
                'bytes': muxer.bytes if muxer else 0}
    except Cancelled:
        if muxer and muxer.error:
            raise muxer.error
        raise
    finally:
        if muxer:
            muxer.close()
