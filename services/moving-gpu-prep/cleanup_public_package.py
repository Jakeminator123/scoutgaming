"""One-off, recoverable cleanup of the package created by failed run 41051847647."""
import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request

REPOSITORY = "Jakeminator123/scoutgaming"
REPOSITORY_ID = 1380630440
OWNER = "Jakeminator123"
PACKAGE = "moving-gpu-prep"
HEAD = "8418878f25d9563358545c9b39ff2391c7036d7f"
DIGEST = "sha256:5e3ecea7694d8b5dd4bf160dd27ad2ac4303da3caaed7080d1b9a3318d9c9e1b"
TAG = "sha-" + HEAD
RUN_ID = 41051847647
RUN_START = "2026-10-30T11:58:01Z"
RUN_END = "2026-10-30T12:01:41Z"
# Verified successful push step, not merely the overall run interval.
PUSH_START = "2026-10-30T12:01:29Z"
PUSH_END = "2026-10-30T12:01:38Z"
PACKAGE_PATH = "/users/" + OWNER + "/packages/container/" + PACKAGE
REGISTRY = "jakeminator123/" + PACKAGE


def require(condition, reason):
    if not condition:
        raise RuntimeError(reason)


def request(url, method="GET", headers=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(
                url, method=method, headers=headers or {}), timeout=30) as response:
            data = json.load(response) if response.status == 200 and method == "GET" else None
            return response.status, data, dict(response.headers)
    except urllib.error.HTTPError as error:
        with error:
            return error.code, None, dict(error.headers)


def api(path, method="GET", authenticated=True):
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if authenticated:
        headers["Authorization"] = "Bearer " + os.environ["GH_TOKEN"]
    return request("https://api.github.com" + path, method, headers)


def get(path, authenticated=True):
    status, data, headers = api(path, authenticated=authenticated)
    require(status == 200, "metadata_unverified_http_" + str(status))
    require('rel="next"' not in headers.get("Link", headers.get("link", "")),
            "additional_metadata_page")
    return data


def within_push(value):
    try:
        return (datetime.fromisoformat(PUSH_START) <= datetime.fromisoformat(value)
                <= datetime.fromisoformat(PUSH_END))
    except (TypeError, ValueError):
        return False


def evidence():
    # Public Actions metadata needs no token or additional Actions permission.
    run = get("/repos/" + REPOSITORY + "/actions/runs/" + str(RUN_ID), authenticated=False)
    require(run.get("id") == RUN_ID and run.get("head_sha") == HEAD
            and run.get("head_branch") == "main" and run.get("event") == "workflow_dispatch"
            and run.get("path") == ".github/workflows/moving-gpu-prep-publish.yml"
            and run.get("status") == "completed" and run.get("conclusion") == "failure"
            and run.get("run_started_at") == RUN_START and run.get("updated_at") == RUN_END
            and run.get("repository", {}).get("id") == REPOSITORY_ID
            and run.get("repository", {}).get("full_name") == REPOSITORY,
            "publication_run_mismatch")
    package = get(PACKAGE_PATH)
    require(package.get("name") == PACKAGE and package.get("package_type") == "container"
            and package.get("visibility") == "public"
            and package.get("owner", {}).get("login") == OWNER
            and package.get("repository", {}).get("id") == REPOSITORY_ID
            and package.get("repository", {}).get("full_name") == REPOSITORY
            and type(package.get("id")) is int and package["id"] > 0
            and package.get("version_count") == 1 and within_push(package.get("created_at")),
            "package_identity_or_creation_mismatch")
    versions = get(PACKAGE_PATH + "/versions?state=active&per_page=2")
    require(isinstance(versions, list) and len(versions) == 1, "additional_or_missing_version")
    require(get(PACKAGE_PATH + "/versions?state=deleted&per_page=2") == [],
            "unexpected_deleted_version")
    version = versions[0]
    require(type(version.get("id")) is int and version["id"] > 0
            and version.get("name") == DIGEST and within_push(version.get("created_at"))
            and version.get("metadata", {}).get("package_type") == "container"
            and version.get("metadata", {}).get("container", {}).get("tags") == [TAG],
            "version_digest_tag_or_creation_mismatch")
    return {"package": PACKAGE, "packageId": package["id"], "versionId": version["id"],
            "digest": DIGEST, "tag": TAG, "publishedHead": HEAD, "publishRun": RUN_ID,
            "packageCreatedAt": package["created_at"], "versionCreatedAt": version["created_at"],
            "repository": REPOSITORY, "repositoryId": REPOSITORY_ID,
            "restoreEndpoint": "https://api.github.com" + PACKAGE_PATH + "/restore",
            "restoreWindowDays": 30}


def anonymous_token():
    query = urllib.parse.urlencode({"service": "ghcr.io", "scope": "repository:" + REGISTRY + ":pull"})
    status, data, _ = request("https://ghcr.io/token?" + query)
    require(status == 200 and isinstance(data, dict) and bool(data.get("token")),
            "anonymous_registry_token_unverified")
    return data["token"]


def manifest(ref, token):
    status, _, headers = request(
        "https://ghcr.io/v2/" + REGISTRY + "/manifests/" + ref, "HEAD",
        {"Authorization": "Bearer " + token,
         "Accept": "application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json"})
    return status, headers.get("Docker-Content-Digest", headers.get("docker-content-digest"))


def cleanup(receipt_path, execute=False, approved_digest=None, confirmed_head=None):
    require(os.environ.get("GITHUB_ACTIONS") == "true"
            and os.environ.get("GITHUB_REPOSITORY") == REPOSITORY
            and os.environ.get("GITHUB_REPOSITORY_ID") == str(REPOSITORY_ID),
            "cleanup_repository_unapproved")
    if execute:
        require(approved_digest == DIGEST and confirmed_head == HEAD, "cleanup_confirmation_mismatch")
    receipt = evidence()
    token = anonymous_token()
    for ref in (DIGEST, TAG):
        status, digest = manifest(ref, token)
        require(status == 200 and digest == DIGEST, "public_manifest_mismatch")
    receipt.update({"dryRun": not execute, "deleteRequested": False, "deleted": False})
    path = Path(receipt_path)

    def save():
        path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")

    save()  # Recovery identifiers are persisted before any mutation.
    if execute:
        require(evidence() == {key: value for key, value in receipt.items()
                              if key not in ("dryRun", "deleteRequested", "deleted")},
                "cleanup_target_changed")
        receipt["deleteRequested"] = True
        save()
        status, _, _ = api(PACKAGE_PATH, method="DELETE")
        receipt["deleteHttpStatus"] = status
        save()
        require(status == 204, "delete_failed_http_" + str(status))
        status, _, _ = api(PACKAGE_PATH)
        receipt["packageAfterHttpStatus"] = status
        save()
        require(status == 404, "package_still_present_or_unverified_http_" + str(status))
        unavailable = {}
        for ref in (DIGEST, TAG):
            # Reuse the previously valid anonymous pull token: no false success
            # merely because a new token could not be acquired after deletion.
            status, _ = manifest(ref, token)
            unavailable[ref] = status
            receipt["anonymousManifestAfter"] = unavailable
            save()
            require(status in (401, 403, 404), "anonymous_manifest_still_available_or_unverified")
        receipt["deleted"] = True
        save()
    print(json.dumps(receipt, sort_keys=True))
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipt", required=True, help="Recovery metadata JSON, never credentials")
    parser.add_argument("--execute", action="store_true", help="Delete only after exact review and confirmation")
    parser.add_argument("--approved-digest")
    parser.add_argument("--confirmed-head")
    args = parser.parse_args()
    cleanup(args.receipt, args.execute, args.approved_digest, args.confirmed_head)


if __name__ == "__main__":
    main()
