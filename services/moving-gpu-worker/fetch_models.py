"""Build-time downloads with pinned source revisions and verified byte hashes."""
import hashlib
import json
from pathlib import Path
import sys
import urllib.request

ROOT = Path(__file__).resolve().parent


def verify(directory):
    entries = json.loads((ROOT / "models.lock.json").read_text())
    for entry in entries:
        path = Path(directory) / entry["file"]
        if path.is_symlink() or not path.is_file() or path.stat().st_size != entry["bytes"]:
            raise ValueError("model_missing_or_changed")
        with path.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != entry["sha256"]:
                raise ValueError("model_hash_mismatch")
    return len(entries)


def fetch(directory):
    for entry in json.loads((ROOT / "models.lock.json").read_text()):
        path = Path(directory) / entry["file"]
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            continue
        part = path.with_name(path.name + ".part")
        try:
            with urllib.request.urlopen(entry["url"], timeout=120) as response, part.open("xb") as output:
                size = 0
                while chunk := response.read(1024 * 1024):
                    size += len(chunk)
                    if size > entry["bytes"]:
                        raise ValueError("model_download_too_large")
                    output.write(chunk)
            with part.open("rb") as stream:
                if size != entry["bytes"] or hashlib.file_digest(stream, "sha256").hexdigest() != entry["sha256"]:
                    raise ValueError("model_hash_mismatch")
            part.replace(path)
        finally:
            part.unlink(missing_ok=True)
    return verify(directory)


if __name__ == "__main__":
    print(json.dumps({"verifiedModels": fetch(sys.argv[1])}))
