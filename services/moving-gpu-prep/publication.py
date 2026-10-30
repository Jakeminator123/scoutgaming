"""Dedicated workflow's private GHCR check and sanitized immutable receipt."""
import argparse
import json
import os
import re
import subprocess
import urllib.error
import urllib.request
from contracts import BASE_IMAGE, verify_release

IMAGE = "ghcr.io/jakeminator123/moving-gpu-prep"


def privacy(allow_absent=False):
    request = urllib.request.Request(
        "https://api.github.com/users/Jakeminator123/packages/container/moving-gpu-prep",
        headers={"Authorization": "Bearer " + os.environ["GH_TOKEN"],
                 "Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if json.load(response).get("visibility") != "private":
                raise RuntimeError("destination_must_be_private")
    except urllib.error.HTTPError as error:
        if not (allow_absent and error.code == 404):
            raise RuntimeError("package_visibility_unverified_http_" + str(error.code)) from None


def main():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--before", action="store_true")
    mode.add_argument("--after", action="store_true")
    args = parser.parse_args()
    if os.environ.get("GITHUB_REF") != "refs/heads/main" or os.environ.get("IMAGE") != IMAGE:
        raise RuntimeError("unapproved_publication")
    privacy(allow_absent=args.before)
    if args.before:
        return
    release = verify_release()
    if release != os.environ["EXPECTED_RELEASE"]:
        raise RuntimeError("release_changed")
    head = os.environ["GITHUB_SHA"]
    if not re.fullmatch(r"[a-f0-9]{40}", head) or head != os.environ["EXPECTED_HEAD"]:
        raise RuntimeError("head_changed")
    inspected = json.loads(subprocess.check_output(
        ["docker", "image", "inspect", IMAGE + ":sha-" + head]))[0]
    refs = [ref for ref in inspected["RepoDigests"]
            if re.fullmatch(re.escape(IMAGE) + r"@sha256:[a-f0-9]{64}", ref)]
    labels = inspected["Config"]["Labels"]
    if (len(refs) != 1 or labels["org.scoutgaming.moving.prep.release"] != release
            or labels["org.scoutgaming.moving.prep.base"] != BASE_IMAGE
            or inspected["Config"]["User"] != "10001"):
        raise RuntimeError("published_image_mismatch")
    receipt = {"schemaVersion": 1, "image": refs[0], "commit": head,
               "releaseSha256": release, "baseImage": BASE_IMAGE, "visibility": "private",
               "checks": "CPU build, offline model initialization and imports, integrity tests",
               "gpuPreparation": False, "deployed": False, "visualApproval": False}
    result = json.dumps(receipt, sort_keys=True)
    print(result)
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
        summary.write("Verified private prep publication:\n\n```json\n" + result + "\n```\n")


if __name__ == "__main__":
    main()
