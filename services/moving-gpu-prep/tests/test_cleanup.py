"""One-off cleanup authority, scope, race and post-deletion checks; no network."""
from copy import deepcopy
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import cleanup_public_package as cleanup


class CleanupTests(unittest.TestCase):
    def setUp(self):
        self.run = {"id": cleanup.RUN_ID, "head_sha": cleanup.HEAD, "head_branch": "main",
                    "event": "workflow_dispatch", "path": ".github/workflows/moving-gpu-prep-publish.yml",
                    "status": "completed", "conclusion": "failure",
                    "run_started_at": cleanup.RUN_START, "updated_at": cleanup.RUN_END,
                    "repository": {"id": cleanup.REPOSITORY_ID, "full_name": cleanup.REPOSITORY}}
        self.package = {"id": 123, "name": cleanup.PACKAGE, "package_type": "container",
                        "visibility": "public", "owner": {"login": cleanup.OWNER},
                        "repository": self.run["repository"].copy(), "version_count": 1,
                        "created_at": "2026-10-30T12:01:35Z"}
        self.versions = [{"id": 456, "name": cleanup.DIGEST, "created_at": "2026-10-30T12:01:37Z",
                          "metadata": {"package_type": "container", "container": {"tags": [cleanup.TAG]}}}]
        self.deleted_versions = []
        self.deleted = False
        self.after_status = 404
        self.manifest_after_status = 404
        self.calls = []
        self.env = {"GITHUB_ACTIONS": "true", "GITHUB_REPOSITORY": cleanup.REPOSITORY,
                    "GITHUB_REPOSITORY_ID": str(cleanup.REPOSITORY_ID)}

    def api(self, path, method="GET", authenticated=True):
        self.calls.append((method, path, authenticated))
        if path.startswith("/repos/"):
            self.assertFalse(authenticated)
            return 200, deepcopy(self.run), {}
        self.assertTrue(authenticated)
        self.assertTrue(path.startswith(cleanup.PACKAGE_PATH))
        if method == "DELETE":
            self.assertEqual(path, cleanup.PACKAGE_PATH)
            self.deleted = True
            return 204, None, {}
        if path == cleanup.PACKAGE_PATH:
            return (self.after_status, None, {}) if self.deleted else (200, deepcopy(self.package), {})
        if path.endswith("?state=active&per_page=2"):
            return 200, deepcopy(self.versions), {}
        if path.endswith("?state=deleted&per_page=2"):
            return 200, deepcopy(self.deleted_versions), {}
        self.fail("Unexpected API path")

    def manifest(self, ref, token):
        self.assertIn(ref, (cleanup.DIGEST, cleanup.TAG))
        self.assertEqual(token, "anonymous-test")
        return (self.manifest_after_status if self.deleted else 200), cleanup.DIGEST

    def invoke(self, directory, execute=False, **kwargs):
        with patch.dict(os.environ, self.env), \
             patch.object(cleanup, "api", side_effect=self.api), \
             patch.object(cleanup, "anonymous_token", return_value="anonymous-test"), \
             patch.object(cleanup, "manifest", side_effect=self.manifest), patch("builtins.print"):
            return cleanup.cleanup(Path(directory) / "receipt.json", execute, **kwargs)

    def execute(self, directory):
        return self.invoke(directory, True, approved_digest=cleanup.DIGEST, confirmed_head=cleanup.HEAD)

    def test_default_is_dry_run_and_preserves_recovery_identifiers(self):
        with tempfile.TemporaryDirectory() as directory:
            receipt = self.invoke(directory)
            self.assertTrue(receipt["dryRun"])
            self.assertFalse(receipt["deleteRequested"])
            self.assertEqual(receipt["versionId"], 456)
            self.assertEqual(receipt["restoreWindowDays"], 30)
            self.assertNotIn("DELETE", [method for method, _, _ in self.calls])
            self.assertEqual(json.loads((Path(directory) / "receipt.json").read_text()), receipt)

    def test_execution_requires_exact_digest_and_published_head_before_network(self):
        for digest, head in [(None, None), (cleanup.DIGEST, "c" * 40), ("sha256:" + "d" * 64, cleanup.HEAD)]:
            with self.subTest(digest=digest, head=head), tempfile.TemporaryDirectory() as directory:
                with self.assertRaisesRegex(RuntimeError, "cleanup_confirmation_mismatch"):
                    self.invoke(directory, True, approved_digest=digest, confirmed_head=head)
                self.assertEqual(self.calls, [])

    def test_wrong_repository_and_non_actions_cannot_read_or_delete(self):
        for key in ("GITHUB_ACTIONS", "GITHUB_REPOSITORY", "GITHUB_REPOSITORY_ID"):
            with self.subTest(key=key), tempfile.TemporaryDirectory() as directory:
                original = self.env[key]
                self.env[key] = "wrong"
                with self.assertRaisesRegex(RuntimeError, "cleanup_repository_unapproved"):
                    self.execute(directory)
                self.env[key] = original
                self.assertEqual(self.calls, [])

    def test_only_exact_original_run_package_version_and_creation_window_can_delete(self):
        mutations = (
            lambda: self.run.update(head_sha="c" * 40),
            lambda: self.run.update(id=42),
            lambda: self.run.update(updated_at="2026-10-30T12:02:00Z"),
            lambda: self.package.update(name="moving-gpu-worker"),
            lambda: self.package.update(owner={"login": "someone"}),
            lambda: self.package.update(repository={"id": 99, "full_name": cleanup.REPOSITORY}),
            lambda: self.package.update(visibility="private"),
            lambda: self.package.update(version_count=2),
            lambda: self.package.update(created_at="2026-10-29T12:01:35Z"),
            lambda: self.versions.append(deepcopy(self.versions[0])),
            lambda: self.versions[0].update(name="sha256:" + "d" * 64),
            lambda: self.versions[0].update(created_at="2026-10-30T12:01:39Z"),
            lambda: self.versions[0]["metadata"]["container"].update(tags=[cleanup.TAG, "extra"]),
            lambda: self.deleted_versions.append(deepcopy(self.versions[0])),
        )
        for index, mutate in enumerate(mutations):
            with self.subTest(index=index), tempfile.TemporaryDirectory() as directory:
                self.setUp()
                mutate()
                with self.assertRaises(RuntimeError):
                    self.execute(directory)
                self.assertFalse(self.deleted)

    def test_success_deletes_only_public_prep_and_checks_metadata_and_both_manifest_refs(self):
        with tempfile.TemporaryDirectory() as directory:
            receipt = self.execute(directory)
            self.assertTrue(receipt["deleted"])
            self.assertEqual(receipt["packageAfterHttpStatus"], 404)
            self.assertEqual(receipt["anonymousManifestAfter"], {cleanup.DIGEST: 404, cleanup.TAG: 404})
            self.assertEqual([path for method, path, _ in self.calls if method == "DELETE"],
                             [cleanup.PACKAGE_PATH])

    def test_changed_identity_during_review_refuses_delete(self):
        original = self.api
        reads = 0

        def changed(path, method="GET", authenticated=True):
            nonlocal reads
            if path == cleanup.PACKAGE_PATH and method == "GET":
                reads += 1
                if reads == 2:
                    self.package["id"] = 789
            return original(path, method, authenticated)

        with tempfile.TemporaryDirectory() as directory, patch.object(self, "api", side_effect=changed):
            with self.assertRaisesRegex(RuntimeError, "cleanup_target_changed"):
                self.execute(directory)
            self.assertFalse(self.deleted)

    def test_delete_cannot_be_reported_verified_when_metadata_or_manifest_is_uncertain(self):
        for kind in ("metadata", "manifest"):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as directory:
                self.setUp()
                if kind == "metadata":
                    self.after_status = 403
                else:
                    self.manifest_after_status = 200
                with self.assertRaises(RuntimeError):
                    self.execute(directory)
                receipt = json.loads((Path(directory) / "receipt.json").read_text())
                self.assertTrue(receipt["deleteRequested"])
                self.assertFalse(receipt["deleted"])
                self.assertEqual(receipt["versionId"], 456)

    def test_paginated_metadata_fails_closed(self):
        with patch.object(cleanup, "api", return_value=(200, [], {"Link": '<next>; rel="next"'})):
            with self.assertRaisesRegex(RuntimeError, "additional_metadata_page"):
                cleanup.get(cleanup.PACKAGE_PATH + "/versions")


if __name__ == "__main__":
    unittest.main()
