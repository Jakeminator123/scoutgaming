"""Small, isolated fixtures: no product data or network access."""
from contextlib import redirect_stderr, redirect_stdout
from html.parser import HTMLParser
import importlib.util
import io
import json
import os
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


class Fixture(unittest.TestCase):
    def setUp(self):
        cache = SCRIPT.parent.parent / ".cache/system-map-tests"
        cache.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix="fixture-", dir=cache)
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


class SystemMapTests(Fixture):
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
        self.assertFalse(any(tag == "a" and "ref" in attrs.get("class", "") for tag, attrs in parsed.tags))

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
        self.assertFalse(any(tag == "img" or "onload" in attrs or "onerror" in attrs for tag, attrs in parsed.tags))
        self.assertEqual(sum(tag == "script" and attrs.get("type") != "application/json" for tag, attrs in parsed.tags), 1)
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


graph_spec = importlib.util.spec_from_file_location("system_map_graph", SCRIPT.parent / "system-map/graph.py")
graph = importlib.util.module_from_spec(graph_spec)
graph_spec.loader.exec_module(graph)


class GraphTests(Fixture):
    def add(self, files):
        for path, text in files.items():
            file = self.root / path
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(text, encoding="utf-8")
        self.command("add", "--", *files)

    def build(self):
        return graph.build_graph(self.root, self.command("rev-parse", "HEAD"), self.root / "tools/system-map/relations.json")

    def test_parser_ignores_comments_strings_regex_and_nested_templates(self):
        source = r'''
// import './not-comment.mjs';
/* require('./not-comment2.mjs') */
const note = "import './not-string.mjs'";
const template = `outer ${`inner ${import('./not-template.mjs')}`} import('./not-template2.mjs')`;
const regex = /import\(['"]\.\/not-regex.mjs['"]\)/g;
if (ready) /require\('\.\/not-regex2.mjs'\)/.test(text);
obj.require('./not-method.mjs'); obj.import('./not-method2.mjs');
import item, {
  other as renamed
} from './real.mjs';
export { item } from "./export.mjs";
import type { Type } from './type.js';
import './side.mjs';
const c = require('./require.cjs');
await import('./dynamic.mjs', {with: {type: 'json'}});
await import('./prefix-' + choice);
await import(`./${choice}.mjs`);
'''
        refs = graph.references(source)
        self.assertEqual([r["specifier"] for r in refs], ["./real.mjs", "./export.mjs", "./type.js", "./side.mjs", "./require.cjs", "./dynamic.mjs", None, None])
        self.assertEqual([r["mode"] for r in refs], ["import", "export", "type", "import", "require", "dynamic", "dynamic", "dynamic"])
        self.assertEqual(refs[0]["line"], source[:source.index("import item")].count("\n") + 1)

    def test_resolves_relative_alias_workspace_and_test_references_without_inventing_targets(self):
        self.add({"apps/ui/tsconfig.json": json.dumps({"compilerOptions": {"paths": {"@/*": ["./*"]}}}),
                  "apps/ui/main.ts": "import './local.js';\nimport '@/local';\nexport { value } from '@fixture/shared';\nimport thing from './missing.mjs';\nimport unknown from '@/missing';\nimport('https://secret.invalid/?token=PRIVATE');\nimport('./'+choice);\nimport fs from 'node:fs';",
                  "apps/ui/local.ts": "export const value=1;",
                  "packages/shared/package.json": json.dumps({"name": "@fixture/shared", "exports": "./entry.mjs"}),
                  "packages/shared/entry.mjs": "export const value=1;",
                  "test/behavior.mjs": "import '../apps/ui/local.ts';"})
        data = self.build()
        refs = [e for e in data["edges"] if e["source"] == "apps/ui/main.ts"]
        self.assertEqual([e["target"] for e in refs], ["apps/ui/local.ts", "apps/ui/local.ts", "packages/shared/entry.mjs"])
        self.assertEqual(data["edges"][-1]["type"], "test")
        self.assertEqual(data["stats"]["unknown"], 4)
        self.assertEqual(data["stats"]["external"], 1)
        self.assertNotIn("PRIVATE", json.dumps(data))
        self.assertNotIn("secret.invalid", json.dumps(data))
        self.assertTrue(next(n for n in data["nodes"] if n["id"] == "apps/ui/main.ts")["dirty"])

    def test_private_ignored_untracked_and_oversize_files_never_enter_inventory(self):
        self.add({".ignore": "/apps/private/\n", ".gitignore": "/apps/ignored/\n",
                  "apps/private/secret.mjs": "import './SENSITIVE.mjs';",
                  "apps/ui/main.mjs": "import './visible.mjs';",
                  "apps/ui/visible.mjs": "export const visible=1;",
                  "apps/ui/large.mjs": "x" * (graph.MAX_BYTES + 1),
                  "random-stuff-jakob/jakob-docs/arkiv/private.mjs": "PRIVATE"})
        ignored = self.root / "apps/ignored/secret.mjs"
        ignored.parent.mkdir(parents=True); ignored.write_text("SECRET", encoding="utf-8")
        self.command("add", "-f", "apps/ignored/secret.mjs")
        (self.root / "apps/ui/untracked.mjs").write_text("PRIVATE", encoding="utf-8")
        data = self.build()
        paths = {n["id"] for n in data["nodes"]}
        self.assertIn("apps/ui/visible.mjs", paths)
        self.assertTrue(all("private" not in p and "ignored" not in p and "untracked" not in p and "large" not in p for p in paths))
        self.assertEqual(data["stats"]["skipped"], {"över 1 MB": 1})
        self.assertNotIn("SENSITIVE", json.dumps(data))

    def test_symlink_cannot_read_outside_source(self):
        self.add({"apps/ui/actual.mjs": "import './safe.mjs';"})
        link = self.root / "apps/ui/link.mjs"
        try:
            os.symlink(self.root / "src/main.py", link)
        except OSError as error:
            self.skipTest(f"Host permits no file symlinks: {error.errno}")
        self.command("add", "apps/ui/link.mjs")
        self.assertFalse(graph.safe_path(self.root, "apps/ui/link.mjs"))
        self.assertNotIn("apps/ui/link.mjs", {n["id"] for n in self.build()["nodes"]})

    def test_semantic_anchors_relocate_and_fail_on_missing_or_ambiguous_match(self):
        manifest = {"graphs": [{"id": "chain", "nodes": [{"id": "a"}, {"id": "b"}], "edges": [
            {"id": "a-b", "source": "a", "target": "b", "kind": "Anrop", "evidence": [{"path": "apps/ui/main.mjs", "match": "run();"}]}]}]}
        self.add({"apps/ui/main.mjs": "// moved\n\nrun();\n", "tools/system-map/relations.json": json.dumps(manifest)})
        data = self.build();edge = data["graphs"][0]["edges"][0]
        self.assertEqual(edge["status"], "anchored")
        self.assertEqual(edge["evidence"][0]["line"], 3)
        self.assertIsNone(edge["evidence"][0]["url"], "dirty source must not claim an exact HEAD link")
        for text, status in [("different();", "missing"), ("run();\nrun();", "ambiguous")]:
            (self.root / "apps/ui/main.mjs").write_text(text, encoding="utf-8")
            data = self.build();proof = data["graphs"][0]["edges"][0]["evidence"][0]
            self.assertEqual(proof["status"], status)
            self.assertIsNone(proof["line"])
            self.assertEqual(len(data["issues"]), 1)


if __name__ == "__main__":
    unittest.main()
