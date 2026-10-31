"""Small, isolated fixtures: no product data or network access."""
from contextlib import redirect_stderr, redirect_stdout
from html.parser import HTMLParser
import importlib.util
import io
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / "tools/system-map.py"
spec = importlib.util.spec_from_file_location("system_map", SCRIPT)
system_map = importlib.util.module_from_spec(spec)
spec.loader.exec_module(system_map)


class Elements(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.tags, self.text = [], []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

    def handle_data(self, data):
        self.text.append(data)


class SystemMapTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="system-map-fixture-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.command("init", "--quiet")
        for path in ["src/main.py", "src/extra.py", "apps/admin/[[...path]]/route.ts", "docs/with space.md"]:
            file = self.root / path
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text("fixture\n", encoding="utf-8")
        self.write_table()
        self.command("add", ".")
        self.command("-c", "user.name=System Map Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgSign=false", "commit", "--quiet", "-m", "fixture")

    def command(self, *args):
        return subprocess.run(["git", "-C", str(self.root), *args], check=True, capture_output=True, text=True).stdout.strip()

    def write_table(self, code="[Koden](src/main.py)", name="Admin: välj bolag", data="Neon: utkast", checks="Behörighetsprov"):
        table = "| " + " | ".join(system_map.HEADERS) + " |\n| --- | --- | --- | --- |\n"
        source = f"# Fixture\n\n## Systemkarta: ansvar\n\n```text\nINTE EN TABELL\n```\n\n{table}| {name} | {code} | {data} | {checks} |\n\n## Annat\n[inte underlag](missing-outside-section)\n"
        (self.root / system_map.SOURCE).write_text(source, encoding="utf-8")

    def invoke(self, *args):
        out, error = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(error):
            status = system_map.main(list(args), root=self.root)
        return status, out.getvalue(), error.getvalue()

    def test_real_git_files_directories_literal_brackets_and_encoded_spaces(self):
        self.write_table(code="[Fil](src/main.py), [mapp](src), [route](apps/admin/[[...path]]/route.ts), [guide](docs/with%20space.md)")
        html, errors, warnings = system_map.render(self.root)
        self.assertEqual((errors, warnings), ([], []))
        parsed = Elements(html)
        links = [attrs["href"] for tag, attrs in parsed.tags if tag == "a"]
        self.assertIn((self.root / "apps/admin/[[...path]]/route.ts").as_uri(), links)
        self.assertIn((self.root / "docs/with space.md").as_uri(), links)
        self.assertIn(self.command("rev-parse", "HEAD"), "".join(parsed.text))
        self.assertIn("Arbetskopian av källan är ändrad", html)
        self.assertNotIn("missing-outside-section", html)

    def test_default_artifact_and_unchanged_source_revision(self):
        status, out, error = self.invoke()
        self.assertEqual(status, 0, error)
        artifact = self.root / ".cache/system-map/index.html"
        self.assertTrue(artifact.is_file())
        self.assertIn(str(artifact), out)
        self.assertIn("Källan motsvarar Git-revisionen", artifact.read_text(encoding="utf-8"))

    def test_missing_untracked_and_locally_deleted_references_fail_clearly(self):
        (self.root / "untracked.py").write_text("fixture", encoding="utf-8")
        (self.root / "src/extra.py").unlink()
        self.write_table(code="[Saknad](missing.py), [Ej spårad](untracked.py), [Borttagen](src/extra.py)")
        status, _, error = self.invoke()
        self.assertEqual(status, 1)
        self.assertIn("missing.py — Saknas i Git-revisionen", error)
        self.assertIn("untracked.py — Saknas i Git-revisionen", error)
        self.assertIn("src/extra.py — Git-spårad men saknas lokalt", error)
        parsed = Elements((self.root / ".cache/system-map/index.html").read_text(encoding="utf-8"))
        self.assertEqual(len([attrs for tag, attrs in parsed.tags if tag == "a"]), 1, "only the source link remains")

    def test_unsafe_references_are_not_clickable(self):
        for target in ["javascript:alert", "https://example.invalid/file", "../outside", "/absolute", "%2e%2e/outside", ".env.local", "src/main.py?x=1", "src/main.py#L3"]:
            with self.subTest(target=target):
                self.write_table(code=f"[Osäker]({target})")
                html, errors, _ = system_map.render(self.root)
                self.assertEqual(len(errors), 1)
                self.assertFalse(any(tag == "a" and "ref" in attrs.get("class", "") for tag, attrs in Elements(html).tags))

    def test_html_is_escaped_and_source_cannot_expand_template_markers(self):
        text = '<img src=x onerror="alert(1)"> & @@CARDS@@'
        self.write_table(code='[<svg onload="alert">](src/main.py)', name="Admin: " + text, data="`</script><script>alert(1)</script>`")
        html, errors, _ = system_map.render(self.root)
        parsed = Elements(html)
        self.assertEqual(errors, [])
        self.assertFalse(any(tag in ("img", "svg") for tag, _ in parsed.tags))
        self.assertEqual(sum(tag == "script" for tag, _ in parsed.tags), 1)
        self.assertIn(text, "".join(parsed.text))
        self.assertIn("</script><script>alert(1)</script>", "".join(parsed.text))

    def test_unlinked_code_is_explicitly_unverified(self):
        self.write_table(code="`main.py` under `src`")
        html, errors, warnings = system_map.render(self.root)
        self.assertEqual(errors, [])
        self.assertEqual(len(warnings), 1)
        self.assertIn("Olänkad kodtext är inte filverifierad", html)

    def test_bad_table_or_partial_markdown_link_returns_input_error(self):
        for change in [lambda text: text.replace("Data och drift", "Fel rubrik"), lambda text: text.replace("| Neon: utkast |", "| |"), lambda text: text.replace("(src/main.py)", "(src/main.py")]:
            self.write_table()
            path = self.root / system_map.SOURCE
            path.write_text(change(path.read_text(encoding="utf-8")), encoding="utf-8")
            status, _, error = self.invoke()
            self.assertEqual(status, 2)
            self.assertIn("Ingen karta skrevs", error)
            self.assertFalse((self.root / ".cache/system-map/index.html").exists())

    def test_output_cannot_overwrite_product_files(self):
        original = (self.root / "src/main.py").read_bytes()
        for output in ["src/main.py", "apps/index.html", "../outside.html", ".cache/../index.html"]:
            status, _, error = self.invoke("--output", output)
            self.assertEqual(status, 2)
            self.assertIn("Utdata måste", error)
        self.assertEqual((self.root / "src/main.py").read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
