"""Seal/check locally; Docker builds are restricted to the explicit cloud CI job."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from contracts import BASE_IMAGE, ROOT, digest, verify_release, verify_sources

REPO = ROOT.parents[1]


def seal():
    files = {str(p.relative_to(ROOT)).replace("\\", "/"): digest(p)
             for p in sorted(ROOT.rglob("*"))
             if p.is_file() and p.name != "release.json" and "__pycache__" not in p.parts
             and p.suffix != ".pyc"}
    (ROOT / "release.json").write_text(json.dumps(
        {"schemaVersion": 1, "baseImage": BASE_IMAGE, "files": files}, indent=2) + "\n",
        encoding="utf-8", newline="\n")
    return verify_release()


def stage(destination):
    release = verify_release()
    sources = verify_sources(repo=REPO)
    manifest = json.loads((ROOT / "release.json").read_text(encoding="utf-8"))
    for name in [*manifest["files"], "release.json"]:
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    for entry in sources:
        target = destination / "sources" / entry["file"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((REPO / entry["source"]).read_bytes().replace(b"\r\n", b"\n"))
    verify_release(destination)
    verify_sources(destination)
    return release


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seal", action="store_true", help="Explicitly reseal reviewed overlay files")
    parser.add_argument("--check", action="store_true", help="Verify complete staged context without Docker")
    parser.add_argument("--tag", default="moving-gpu-prep:check")
    args = parser.parse_args()
    if args.seal:
        print(seal())
        return
    if not re.fullmatch(r"moving-gpu-prep:[a-z0-9][a-z0-9._-]*", args.tag):
        parser.error("Only local moving-gpu-prep tags are allowed")
    with tempfile.TemporaryDirectory(prefix="moving-prep-build-") as temporary:
        release = stage(Path(temporary))
        if args.check:
            print(json.dumps({"releaseSha256": release, "sourcesVerified": True}))
            return
        if os.environ.get("GITHUB_ACTIONS") != "true":
            parser.error("Image builds run only in the dedicated cloud workflow; use --check locally")
        subprocess.run(["docker", "build", "--platform", "linux/amd64",
                        "--label", "org.opencontainers.image.source=https://github.com/Jakeminator123/scoutgaming",
                        "--label", "org.scoutgaming.moving.prep.release=" + release,
                        "--label", "org.scoutgaming.moving.prep.base=" + BASE_IMAGE,
                        "--tag", args.tag, temporary], check=True)


if __name__ == "__main__":
    main()
