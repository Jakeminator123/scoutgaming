"""Local-only Docker build using the reviewed base digest. Never publish."""
import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
from contracts import verify_release
ROOT = Path(__file__).resolve().parent
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tag", default="croupier-moving-worker:local")
    parser.add_argument("--target", choices=("runtime","serverless"), default="runtime")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z][a-z0-9-]*:[a-z0-9][a-z0-9._-]*", args.tag):
        parser.error("Use a local image name and tag, without a registry.")
    release = verify_release(ROOT)
    config = json.loads((ROOT / "build-contract.json").read_text())
    if not re.fullmatch(r"ubuntu:24[.]04@sha256:[a-f0-9]{64}", config["baseImage"]):
        raise ValueError("Unpinned base image")
    docker = shutil.which("docker")
    if not docker:
        raise SystemExit("Docker unavailable; no installation or service start attempted.")
    subprocess.run([docker, "build", "--platform", config["platform"], "--target", args.target,
                    "--build-arg", "BASE_IMAGE=" + config["baseImage"],
                    "--label", "org.scoutgaming.moving.release=" + release,
                    "--tag", args.tag, str(ROOT)], check=True)
