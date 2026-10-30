"""Behavioral checks: changed source and incomplete model bytes fail closed."""
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from contracts import BASE_IMAGE, digest, verify_release, verify_sources
import build
import models


class IntegrityTests(unittest.TestCase):
    def test_real_context_stages_without_docker(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            release = build.stage(root)
            self.assertEqual(release, verify_release(root))
            self.assertEqual(len(verify_sources(root)), 2)

    def test_changed_sealed_file_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "example.py").write_bytes(b"first")
            release = {"schemaVersion": 1, "baseImage": BASE_IMAGE,
                       "files": {"example.py": digest(root / "example.py")}}
            (root / "release.json").write_text(json.dumps(release))
            verify_release(root)
            (root / "example.py").write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "release_file_changed"):
                verify_release(root)

    def test_parent_path_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            release = {"schemaVersion": 1, "baseImage": BASE_IMAGE,
                       "files": {"../outside": "0" * 64}}
            (root / "release.json").write_text(json.dumps(release))
            with self.assertRaisesRegex(ValueError, "invalid_release_path"):
                verify_release(root)

    def test_source_is_bound_after_checkout_line_ending_normalization(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "sources").mkdir()
            content = b"source\n"
            (root / "sources/tool.py").write_bytes(b"source\r\n")
            (root / "sources.lock.json").write_text(json.dumps([{
                "file": "tool.py", "sha256": hashlib.sha256(content).hexdigest()}]))
            verify_sources(root)
            (root / "sources/tool.py").write_bytes(b"changed\n")
            with self.assertRaisesRegex(ValueError, "source_changed"):
                verify_sources(root)

    def download(self, payload, existing=None):
        good = b"reviewed-model"
        entry = {"file": "model/weights", "url": "https://example.test/model",
                 "bytes": len(good), "sha256": hashlib.sha256(good).hexdigest()}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / entry["file"]
            if existing is not None:
                target.parent.mkdir()
                target.write_bytes(existing)
            with patch.object(models, "entries", return_value=[entry]), \
                 patch.object(models.urllib.request, "urlopen", return_value=io.BytesIO(payload)) as request:
                if payload == good and existing is None:
                    self.assertEqual(models.fetch(root), 1)
                    self.assertEqual(target.read_bytes(), good)
                    models.fetch(root)
                    self.assertEqual(request.call_count, 1)
                else:
                    with self.assertRaises(ValueError):
                        models.fetch(root)
                    self.assertFalse(target.with_name("weights.part").exists())
                    if existing is not None:
                        self.assertEqual(target.read_bytes(), existing)
                    else:
                        self.assertFalse(target.exists())

    def test_verified_download_is_reused(self):
        self.download(b"reviewed-model")

    def test_truncated_and_different_bytes_are_rejected(self):
        for content in (b"short", b"corrupt-model!", b"too-large" * 4):
            with self.subTest(content=content):
                self.download(content)

    def test_changed_existing_model_is_not_overwritten(self):
        self.download(b"reviewed-model", existing=b"wrong")


if __name__ == "__main__":
    unittest.main()
