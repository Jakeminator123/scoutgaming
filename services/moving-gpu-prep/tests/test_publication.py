"""Publication authority and private-package gates, without registry writes."""
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
import urllib.error
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import publication


class PublicationTests(unittest.TestCase):
    def env(self):
        return {"GH_TOKEN": "test-only", "GITHUB_REPOSITORY": "Jakeminator123/scoutgaming",
                "GITHUB_REPOSITORY_ID": "1380630440", "GITHUB_REF": "refs/heads/main",
                "IMAGE": publication.IMAGE, "APPROVED_TARGET": publication.IMAGE,
                "GITHUB_SHA": "a" * 40, "EXPECTED_HEAD": "a" * 40,
                "EXPECTED_RELEASE": "b" * 64}

    def test_public_package_is_rejected(self):
        with patch.dict(os.environ, self.env()), \
             patch.object(publication.urllib.request, "urlopen",
                          return_value=io.BytesIO(b'{"visibility":"public"}')):
            with self.assertRaisesRegex(RuntimeError, "destination_must_be_private"):
                publication.privacy()

    def test_existing_private_package_is_accepted(self):
        with patch.dict(os.environ, self.env()), \
             patch.object(publication.urllib.request, "urlopen",
                          return_value=io.BytesIO(b'{"visibility":"private"}')) as request:
            publication.privacy()
            self.assertEqual(request.call_args.args[0].full_url,
                             "https://api.github.com/users/Jakeminator123/packages/container/moving-gpu-worker")

    def test_absent_or_inaccessible_destination_is_always_rejected(self):
        for mode in ("--before", "--after"):
            for code in (404, 403, 500):
                with self.subTest(mode=mode, code=code), \
                     patch.dict(os.environ, self.env()), \
                     patch.object(sys, "argv", ["publication.py", mode]), \
                     patch.object(publication, "verify_release", return_value="b" * 64), \
                     patch.object(publication.urllib.request, "urlopen",
                                  side_effect=urllib.error.HTTPError(
                                      "https://example.test", code, "", {}, None)), \
                     patch.object(publication.subprocess, "check_output") as docker:
                    with self.assertRaisesRegex(RuntimeError, "package_visibility_unverified"):
                        publication.main()
                    docker.assert_not_called()

    def test_wrong_authority_is_rejected_before_network(self):
        for key, value, message in (
                ("GITHUB_REF", "refs/heads/feature", "unapproved_publication"),
                ("GITHUB_REPOSITORY_ID", "999", "unapproved_publication"),
                ("GITHUB_REPOSITORY", "someone/scoutgaming", "unapproved_publication"),
                ("IMAGE", "ghcr.io/jakeminator123/moving-gpu-prep", "unapproved_publication"),
                ("APPROVED_TARGET", "another/image", "unapproved_publication"),
                ("EXPECTED_HEAD", "c" * 40, "head_changed"),
                ("EXPECTED_RELEASE", "c" * 64, "release_changed")):
            env = {**self.env(), key: value}
            with self.subTest(key=key), patch.dict(os.environ, env), \
                 patch.object(sys, "argv", ["publication.py", "--before"]), \
                 patch.object(publication, "verify_release", return_value="b" * 64), \
                 patch.object(publication, "privacy") as privacy:
                with self.assertRaisesRegex(RuntimeError, message):
                    publication.main()
                privacy.assert_not_called()

    def test_receipt_inspects_unique_prep_tag_and_requires_frozen_labels_and_uid(self):
        for mutation in ("none", "uid", "release", "base", "digest"):
            inspected = {"RepoDigests": [publication.IMAGE + "@sha256:" + "d" * 64],
                         "Config": {"User": "10001", "Labels": {
                             "org.scoutgaming.moving.prep.release": "b" * 64,
                             "org.scoutgaming.moving.prep.base": publication.BASE_IMAGE}}}
            if mutation == "uid":
                inspected["Config"]["User"] = "0"
            elif mutation in ("release", "base"):
                inspected["Config"]["Labels"]["org.scoutgaming.moving.prep." + mutation] = "wrong"
            elif mutation == "digest":
                inspected["RepoDigests"] = []
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as directory, \
                 patch.dict(os.environ, {**self.env(), "GITHUB_STEP_SUMMARY": str(Path(directory) / "summary")}), \
                 patch.object(sys, "argv", ["publication.py", "--after"]), \
                 patch.object(publication, "privacy"), \
                 patch.object(publication, "verify_release", return_value="b" * 64), \
                 patch.object(publication.subprocess, "check_output",
                              return_value=json.dumps([inspected]).encode()) as docker, \
                 patch("builtins.print"):
                if mutation == "none":
                    publication.main()
                else:
                    with self.assertRaisesRegex(RuntimeError, "published_image_mismatch"):
                        publication.main()
                self.assertEqual(docker.call_args.args[0][-1],
                                 publication.IMAGE + ":prep-sha-" + "a" * 40)


if __name__ == "__main__":
    unittest.main()
