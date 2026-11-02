import hashlib
import importlib.util
import lzma
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "workers" / "restore_assets.py"
spec = importlib.util.spec_from_file_location("restore_assets", SCRIPT)
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


class RestoreAssetsTests(unittest.TestCase):
    def test_build_command_restores_all_original_runtime_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "avatar"
            subprocess.run([sys.executable, str(SCRIPT), str(ROOT / "assets"),
                            str(destination)], check=True)
            self.assertEqual(
                {p.relative_to(destination).as_posix() for p in destination.rglob("*") if p.is_file()},
                {name for name, *_ in assets.ASSETS},
            )
            for name, _, size, digest in assets.ASSETS:
                data = (destination / name).read_bytes()
                self.assertEqual(len(data), size)
                self.assertEqual(hashlib.sha256(data).hexdigest(), digest)

    def assert_rejected(self, name, replacement, error):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source"
            destination = Path(directory) / "avatar"
            shutil.copytree(ROOT / "assets", source)
            path = source / name
            if replacement is None:
                path.unlink()
            else:
                path.write_bytes(replacement)
            with self.assertRaises(error):
                assets.restore_assets(source, destination)
            self.assertFalse(destination.exists(), "Invalid input must fail before any output")

    def test_missing_archive_fails_before_writing(self):
        self.assert_rejected("astrid_spel2x/talk_base.yuv.xz", None, FileNotFoundError)

    def test_truncated_archive_fails_before_writing(self):
        name = "astrid_spel2x/talk_base.yuv.xz"
        self.assert_rejected(name, (ROOT / "assets" / name).read_bytes()[:-10], EOFError)

    def test_wrong_bytes_with_valid_xz_checksum_are_rejected(self):
        self.assert_rejected("talk_base.yuv.xz", lzma.compress(b"\0" * 3110400), ValueError)

    def test_oversized_raw_data_is_rejected(self):
        self.assert_rejected("talk_base.yuv.xz", lzma.compress(b"\0" * 3110401), ValueError)

    def test_uncompressed_png_is_also_verified(self):
        self.assert_rejected("talk_base.png", b"not the original PNG", ValueError)


if __name__ == "__main__":
    unittest.main()
