"""Build-time only model acquisition; no download belongs to the GPU job."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import urllib.request
from contracts import ROOT, confined, digest


def entries():
    result = json.loads((ROOT / "models.lock.json").read_text(encoding="utf-8"))
    for entry in result:
        path = PurePosixPath(entry["file"])
        if path.is_absolute() or ".." in path.parts or "\\" in entry["file"] or ":" in entry["file"]:
            raise ValueError("invalid_model_path")
        if not entry["url"].startswith("https://") or type(entry["bytes"]) is not int or entry["bytes"] <= 0:
            raise ValueError("invalid_model_source")
    return result


def verify(directory):
    for entry in entries():
        path = confined(directory, entry["file"])
        if path.stat().st_size != entry["bytes"] or digest(path) != entry["sha256"]:
            raise ValueError("model_changed: " + entry["file"])
    return len(entries())


def fetch(directory):
    directory = Path(directory)
    for entry in entries():
        path = directory / entry["file"]
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.parent.resolve().is_relative_to(directory.resolve()) or path.is_symlink():
            raise ValueError("invalid_model_path")
        if path.exists():
            if path.stat().st_size != entry["bytes"] or digest(path) != entry["sha256"]:
                raise ValueError("model_changed: " + entry["file"])
            continue
        part = path.with_name(path.name + ".part")
        try:
            with part.open("xb") as output, urllib.request.urlopen(entry["url"], timeout=120) as response:
                size, checksum = 0, hashlib.sha256()
                while chunk := response.read(1024 * 1024):
                    size += len(chunk)
                    if size > entry["bytes"]:
                        raise ValueError("model_too_large")
                    checksum.update(chunk)
                    output.write(chunk)
            if size != entry["bytes"] or checksum.hexdigest() != entry["sha256"]:
                raise ValueError("model_hash_mismatch")
            part.replace(path)
        finally:
            part.unlink(missing_ok=True)
    return verify(directory)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--fetch", type=Path, required=True)
    print(json.dumps({"verifiedModels": fetch(parser.parse_args().fetch)}))
