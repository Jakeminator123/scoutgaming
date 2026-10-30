"""Small, stdlib-only integrity contract for the separate BANK PREP overlay."""
import hashlib
import json
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent
BASE_IMAGE = "ghcr.io/jakeminator123/moving-gpu-worker@sha256:eb5a6b4707eaba54839cc562b554ff7a8af37f5897e739a5533f2357f867135a"
BASE_RELEASE = "5908716a81532d29e8b2e9aece3a8639258a7f56dad2ee3b6d98fcc343d0c08c"


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def confined(root, name):
    path = PurePosixPath(name)
    if not name or path.is_absolute() or ".." in path.parts or "\\" in name or ":" in name:
        raise ValueError("invalid_release_path")
    result = Path(root) / name
    if result.is_symlink() or not result.is_file() or not result.resolve().is_relative_to(Path(root).resolve()):
        raise ValueError("invalid_release_file")
    return result


def verify_release(root=ROOT):
    root = Path(root)
    release = json.loads((root / "release.json").read_text(encoding="utf-8"))
    if release.get("schemaVersion") != 1 or release.get("baseImage") != BASE_IMAGE or not release.get("files"):
        raise ValueError("invalid_release")
    for name, expected in release["files"].items():
        if digest(confined(root, name)) != expected:
            raise ValueError("release_file_changed: " + name)
    return hashlib.sha256(canonical(release)).hexdigest()


def verify_sources(root=ROOT, repo=None):
    root = Path(root)
    entries = json.loads((root / "sources.lock.json").read_text(encoding="utf-8"))
    for entry in entries:
        path = confined(repo, entry["source"]) if repo else confined(root, "sources/" + entry["file"])
        # Git's text checkout can use CRLF. The image always receives canonical LF.
        content = path.read_bytes().replace(b"\r\n", b"\n")
        if hashlib.sha256(content).hexdigest() != entry["sha256"]:
            raise ValueError("source_changed: " + entry["file"])
    return entries


if __name__ == "__main__":
    print(json.dumps({"releaseSha256": verify_release()}))
    verify_sources()
