"""Recompute the code release only after review/test; never called at runtime."""
import hashlib
import json
from pathlib import Path
from contracts import canonical, digest

ROOT = Path(__file__).resolve().parent
FILES = ("contracts.py", "session.py", "engine.py", "entrypoint.py", "fetch_models.py",
         "vendor/motor.py", "vendor/rorlig.py", "source.json", "requirements.lock",
         "wheels.lock", "models.lock.json", "Dockerfile", "build-contract.json",
         "serverless.py", "requirements-serverless.lock", "serverless-wheels.lock",
         ".gitattributes", "build.py", "lock_wheels.py", "seal_release.py")

if __name__ == "__main__":
    payload = {"schemaVersion": 1, "files": {name: digest(ROOT / name) for name in sorted(FILES)}}
    release_sha = hashlib.sha256(canonical(payload).encode()).hexdigest()
    (ROOT / "release.json").write_text(json.dumps({**payload, "releaseSha256": release_sha}, indent=2) + "\n")
    print(json.dumps({"releaseSha256": release_sha, "files": len(FILES)}))
