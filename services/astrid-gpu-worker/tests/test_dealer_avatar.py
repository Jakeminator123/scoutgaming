import base64
import hashlib
import importlib.util
from pathlib import Path
import struct
import tempfile
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zlib

spec = importlib.util.spec_from_file_location('dealer_avatar', Path(__file__).parents[1] / 'workers' / 'dealer_avatar.py')
avatar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(avatar)


def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)


def png(width=1080, height=1920, extra=b''):
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress((b'\0' + b'\0' * (width * 3)) * height)) + extra + chunk(b'IEND', b'')


def payload(image=None):
    image = png() if image is None else image
    return {'schemaVersion': 1, 'dealerId': 'paow', 'profileRevision': 'a' * 64,
            'imageSha256': hashlib.sha256(image).hexdigest(), 'imageBase64': base64.b64encode(image).decode()}


class DealerAvatarTest(unittest.TestCase):
    def test_handler_switches_immutable_process_and_restores_legacy_without_fallback(self):
        processes, cleaned = [], []
        class Pipe:
            def write(self, value): pass
            def flush(self): pass
            def close(self): pass
            def readline(self): return '{"ready":true,"ok":true,"reason":"bye"}\n'
        class Process:
            def __init__(self, *args, **kwargs):
                self.env=kwargs['env'];self.stdin=Pipe();self.stdout=Pipe();self.stopped=False;processes.append(self)
            def poll(self): return 0 if self.stopped else None
            def kill(self): self.stopped=True
            def wait(self, **kwargs): return 0
        root=str(Path(__file__).parents[1])
        sys.path.insert(0,root)
        try:
            module_spec=importlib.util.spec_from_file_location('isolated_dealer_handler',Path(root)/'handler.py')
            module=importlib.util.module_from_spec(module_spec)
            with patch.dict(sys.modules,{'runpod':SimpleNamespace(serverless=SimpleNamespace(start=lambda value:None))}), patch('subprocess.Popen',Process):
                module_spec.loader.exec_module(module)
                def prepare(value):
                    return {'id':'dealer-session-test0000','directory':'/isolated/dealer-session-test0000','binding':avatar.validate_avatar(value)[1]}
                with patch.object(module,'prepare_avatar_assets',prepare),patch.object(module,'cleanup_avatar_assets',lambda value:cleaned.append(value)):
                    legacy=module.ENGINE
                    paow=module._select_engine(payload())
                    self.assertTrue(legacy.proc.stopped)
                    self.assertEqual(paow.binding['dealerId'],'paow')
                    self.assertIn('DEALER_SPEECH_BINDING',paow.proc.env)
                    self.assertIs(module._select_engine(payload()),paow)
                    with self.assertRaises(ValueError):module._select_engine(dict(payload(),dealerId='../astrid'))
                    self.assertIs(module.ENGINE,paow,'invalid identity never falls back to legacy')
                    restored=module._select_engine()
                    self.assertTrue(paow.proc.stopped);self.assertEqual(len(cleaned),1)
                    self.assertIsNone(restored.binding);self.assertNotIn('DEALER_SPEECH_BINDING',restored.proc.env)
                    module.ENGINE.close()
        finally:
            sys.path.remove(root)

    def test_hash_dimensions_animation_crc_and_paths_are_rejected(self):
        valid = payload()
        image, binding = avatar.validate_avatar(valid)
        self.assertEqual(binding['dealerId'], 'paow')
        self.assertEqual(binding['protocolVersion'], 3)
        for bad in [dict(valid, dealerId='../astrid'), dict(valid, imageSha256='b' * 64),
                    dict(valid, imageBase64=valid['imageBase64'] + '\n'), dict(valid, schemaVersion=True),
                    payload(png(1082, 1920)), payload(png(extra=chunk(b'acTL', b'\0' * 8))),
                    payload(image[:-1] + b'!'), payload(image + b'trailing')]:
            with self.subTest(bad=list(bad)):
                with self.assertRaises(ValueError):
                    avatar.validate_avatar(bad)

    def test_preparation_creates_owned_reference_without_external_fetch_and_cleans_failure(self):
        calls = []
        def run(args, **options):
            calls.append((args, options))
            Path(args[-1]).write_bytes(b'\0' * (1080 * 1920 * 3 // 2))
        with tempfile.TemporaryDirectory() as root, tempfile.TemporaryDirectory() as cache:
            assets = avatar.prepare_avatar_assets(payload(), root=root, run=run)
            self.assertEqual((Path(assets['directory']) / 'talk_base.png').read_bytes(), png())
            self.assertEqual(calls[0][1]['timeout'], 30)
            self.assertIn('file,pipe', calls[0][0])
            avatar.cleanup_avatar_assets(assets, root=root, cache_root=cache)
            self.assertEqual(list(Path(root).iterdir()), [])
            with self.assertRaises(ValueError):
                avatar.cleanup_avatar_assets({'id':'astrid_talk2x','directory':root},root=root,cache_root=cache)
            def failed(*args, **kwargs):
                raise RuntimeError('synthetic decode failure')
            with self.assertRaises(RuntimeError):
                avatar.prepare_avatar_assets(payload(), root=root, run=failed)
            self.assertEqual(list(Path(root).iterdir()), [])


if __name__ == '__main__':
    unittest.main()
