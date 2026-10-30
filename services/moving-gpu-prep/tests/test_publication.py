"""Publication authority and private-package gates, without registry writes."""
import io
import os
from pathlib import Path
import sys
import unittest
import urllib.error
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import publication


class PublicationTests(unittest.TestCase):
    def test_public_package_is_rejected(self):
        with patch.dict(os.environ, {"GH_TOKEN": "test-only"}), \
             patch.object(publication.urllib.request, "urlopen",
                          return_value=io.BytesIO(b'{"visibility":"public"}')):
            with self.assertRaisesRegex(RuntimeError, "destination_must_be_private"):
                publication.privacy(allow_absent=True)

    def test_private_package_is_accepted(self):
        with patch.dict(os.environ, {"GH_TOKEN": "test-only"}), \
             patch.object(publication.urllib.request, "urlopen",
                          return_value=io.BytesIO(b'{"visibility":"private"}')):
            publication.privacy()

    def test_only_prepublication_absence_is_allowed(self):
        for before, code in [(True, 404), (False, 404), (True, 403), (True, 500)]:
            with self.subTest(before=before, code=code), \
                 patch.dict(os.environ, {"GH_TOKEN": "test-only"}), \
                 patch.object(publication.urllib.request, "urlopen",
                              side_effect=urllib.error.HTTPError("https://example.test", code, "", {}, None)):
                if before and code == 404:
                    publication.privacy(allow_absent=before)
                else:
                    with self.assertRaisesRegex(RuntimeError, "package_visibility_unverified"):
                        publication.privacy(allow_absent=before)

    def test_nonmain_publication_is_rejected_before_network(self):
        with patch.dict(os.environ, {"GITHUB_REF": "refs/heads/feature",
                                     "IMAGE": publication.IMAGE}), \
             patch.object(sys, "argv", ["publication.py", "--before"]), \
             patch.object(publication, "privacy") as privacy:
            with self.assertRaisesRegex(RuntimeError, "unapproved_publication"):
                publication.main()
            privacy.assert_not_called()


if __name__ == "__main__":
    unittest.main()
