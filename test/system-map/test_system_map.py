"""Small, isolated fixtures: no product data or network access."""
from contextlib import redirect_stderr, redirect_stdout
from copy import deepcopy
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
        self.write_relations({"version": 1, "graphs": []})
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

    def artifact_data(self):
        html = (self.root / ".cache/system-map/index.html").read_text(encoding="utf-8")
        return json.loads(html.split('<script id="atlas-data" type="application/json">', 1)[1].split('</script>', 1)[0])

    def write_relations(self, data):
        file = self.root / "tools/system-map/relations.json"
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(json.dumps(data), encoding="utf-8")

    def relation_fixture(self):
        return {"version": 1, "graphs": [{"id": "chain", "category": "code", "title": "Fixture chain", "nodes": [
            {"id": "a", "label": "Caller", "place": "Fixture", "col": 0, "row": 0},
            {"id": "b", "label": "Callee", "place": "Fixture", "col": 1, "row": 0}], "edges": [
            {"id": "a-b", "source": "a", "target": "b", "kind": "Anrop", "label": "Run", "explanation": "Fixture calls run.",
             "conditional": False, "evidence": [{"path": "apps/ui/main.mjs", "match": "run();"}]}]}]}


class SystemMapTests(Fixture):
    def test_missing_relations_manifest_fails_without_replacing_previous_artifact(self):
        self.assertEqual(self.invoke()[0], 0)
        artifact = self.root / ".cache/system-map/index.html"
        original = artifact.read_bytes()
        (self.root / "tools/system-map/relations.json").unlink()
        for args in [(), ("--strict-anchors",)]:
            status, _, error = self.invoke(*args)
            self.assertEqual(status, 2)
            self.assertIn("relations.json saknas", error)
            self.assertIn("Ingen karta skrevs", error)
            self.assertEqual(artifact.read_bytes(), original)

    def test_invalid_relation_schema_returns_input_error_without_a_new_artifact(self):
        base = self.relation_fixture()
        cases = [(None, "rot"), ({}, "version"), ({"version": 1}, "graphs"), ({"version": 1, "graphs": {}}, "graphs")]
        edits = [(("version",), 2), (("graphs", 0), None), (("graphs", 0, "title"), ""),
                 (("graphs", 0, "nodes"), {}), (("graphs", 0, "nodes", 0, "col"), False),
                 (("graphs", 0, "nodes", 1, "id"), "a"), (("graphs", 0, "edges"), None),
                 (("graphs", 0, "edges", 0, "source"), "unknown"), (("graphs", 0, "edges", 0, "conditional"), "false"),
                 (("graphs", 0, "edges", 0, "evidence"), []), (("graphs", 0, "edges", 0, "evidence"), None),
                 (("graphs", 0, "edges", 0, "evidence", 0), {}),
                 (("graphs", 0, "edges", 0, "evidence", 0, "path"), "../outside.mjs"),
                 (("graphs", 0, "edges", 0, "evidence", 0, "match"), ""),
                 (("graphs", 0, "edges", 0, "evidence", 0, "match"), ["run();"])]
        for path, value in edits:
            data = deepcopy(base)
            target = data
            for key in path[:-1]:
                target = target[key]
            target[path[-1]] = value
            cases.append((data, str(path[-1]) if isinstance(path[-1], str) else "[0]"))
        for data, location in cases:
            with self.subTest(location=location, data=data):
                self.write_relations(data)
                for args in [(), ("--strict-anchors",)]:
                    status, _, error = self.invoke(*args)
                    self.assertEqual(status, 2)
                    self.assertIn("relations.json:", error)
                    self.assertIn(location, error)
                    self.assertIn("Ingen karta skrevs", error)
                    self.assertFalse((self.root / ".cache/system-map/index.html").exists())
        for args in [(), ("--strict-anchors",)]:
            (self.root / "tools/system-map/relations.json").write_text('{"version":', encoding="utf-8")
            self.assertEqual(self.invoke(*args)[0], 2)
            self.assertFalse((self.root / ".cache/system-map/index.html").exists())

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

    def test_control_references_preserve_evidence_and_private_boundaries(self):
        self.add({"AGENTS.md": "See `tools/ci-changes.mjs` and `.githooks/pre-commit-full`.\n",
                  ".github/workflows/ci.yml": "run: node tools/ci-changes.mjs\n# node tools/hidden.mjs\n",
                  ".githooks/pre-commit-full": "# registry\n",
                  ".cursor/rules/repo.mdc": "Read `AGENTS.md`.\n",
                  ".ignore": "tools/hidden.mjs\n",
                  ".cursorignore": ".env*\n!.env.example\n/private/\n",
                  ".codex/config.toml": 'secret = "PRIVATE_CODEX_BYTES"\n',
                  ".claude/settings.json": '{"secret":"PRIVATE_CLAUDE_BYTES"}',
                  "tools/ci-changes.mjs": "export const run = 1;\n",
                  "tools/hidden.mjs": "IGNORED_PRIVATE_BYTES\n"})
        data = self.build()
        controls = data["controls"]
        self.assertIn("AGENTS.md", {f["id"] for f in controls["files"]})
        self.assertIn((".github/workflows/ci.yml", "tools/ci-changes.mjs", 1),
                      {(e["source"], e["target"], e["line"]) for e in controls["edges"]})
        self.assertIn(("AGENTS.md", ".githooks/pre-commit-full"), {(e["source"], e["target"]) for e in controls["edges"]})
        rules = next(f for f in controls["files"] if f["id"] == ".cursorignore")
        self.assertEqual([p["pattern"] for p in rules["patterns"]], [".env*", "!.env.example", "/private/"])
        self.assertTrue(rules["proof"]["dirty"])
        self.assertIsNone(rules["proof"]["url"])
        encoded = json.dumps(data)
        for marker in ["PRIVATE_CODEX_BYTES", "PRIVATE_CLAUDE_BYTES", "IGNORED_PRIVATE_BYTES", ".codex/config.toml"]:
            self.assertNotIn(marker, encoded)
        self.assertFalse(any(e["target"] == "tools/hidden.mjs" for e in controls["edges"]))

    def test_registry_commands_require_known_runner_and_exact_safe_matching(self):
        runner = 'run_check "$selected" "$name" "$seconds" node --test --test-concurrency=4 --test-reporter=spec "$@"\n'
        self.add({".githooks/pre-commit-full": runner +
                  'run_node_tests studio ui "apps/ui/test/**/*.test.mjs"\n'
                  'run_check access standalone 180 node test/standalone.mjs\n'
                  'run_check contracts map 90 python -m unittest discover -s test/system-map -v\n'
                  'run_check contracts tool 60 node tools/check.mjs\n'
                  'run_node_tests bad unsafe "test/$(oops).mjs"\n',
                  "apps/ui/test/a.test.mjs": "export {};\n", "apps/ui/test/nested/b.test.mjs": "export {};\n",
                  "test/standalone.mjs": "export {};\n", "test/unregistered.mjs": "export {};\n",
                  "test/system-map/test_fixture.py": "pass\n", "test/system-map/helper.py": "pass\n",
                  "tools/check.mjs": "export {};\n"})
        commands = self.build()["controls"]["commands"]
        self.assertEqual({c["path"] for c in commands}, {"apps/ui/test/a.test.mjs", "apps/ui/test/nested/b.test.mjs", "test/standalone.mjs", "test/system-map/test_fixture.py"})
        direct = next(c for c in commands if c["path"] == "apps/ui/test/a.test.mjs")
        self.assertEqual(direct["command"], 'node --test --test-concurrency=2 --test-reporter=spec "apps/ui/test/a.test.mjs"')
        self.assertEqual(direct["proof"]["line"], 2)
        self.assertEqual(direct["runnerProof"]["line"], 1)
        self.assertEqual(direct["suiteCommand"], "sh .githooks/pre-commit-full studio")
        self.assertEqual(next(c for c in commands if c["path"] == "test/standalone.mjs")["command"], 'node "test/standalone.mjs"')
        (self.root / ".githooks/pre-commit-full").write_text('run_node_tests studio ui "apps/ui/test/**/*.test.mjs"\n', encoding="utf-8")
        self.assertEqual(self.build()["controls"]["commands"], [])

    def test_semantic_control_anchors_use_actual_ci_and_hook_lines(self):
        self.add({".github/workflows/ci.yml": "run: sh .githooks/pre-commit-full contracts\n",
                  ".githooks/pre-commit-full": "run_check contracts map 60 python tools/system-map.py\n"})
        relations = self.relation_fixture()
        relations["graphs"][0]["edges"][0]["evidence"] = [
            {"path": ".github/workflows/ci.yml", "match": "run: sh .githooks/pre-commit-full contracts"},
            {"path": ".githooks/pre-commit-full", "match": "run_check contracts map 60 python tools/system-map.py"}]
        self.write_relations(relations)
        self.assertEqual(self.invoke("--strict-anchors")[0], 0)
        edge = self.artifact_data()["graphs"][0]["edges"][0]
        self.assertEqual(edge["status"], "anchored")
        self.assertEqual([p["line"] for p in edge["evidence"]], [1, 1])
        (self.root / ".github/workflows/ci.yml").write_text("changed\n", encoding="utf-8")
        self.assertEqual(self.invoke("--strict-anchors")[0], 1)

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

    def test_regex_expression_positions_do_not_create_false_references(self):
        for expression in ["ready ? /require('fake')/ : /import('fake')/", "ready ?? /require('fake')/",
                           "ready && /require('fake')/", "ready |= /require('fake')/", "ready !== /require('fake')/",
                           "ready + /require('fake')/", "ready / /require('fake')/", "typeof /require('fake')/",
                           "void /require('fake')/", "await /require('fake')/", "[.../require('fake')/.source]"]:
            with self.subTest(expression=expression):
                refs = graph.references(f"const pattern = {expression};\nrequire('./real.cjs');")
                self.assertEqual(refs, [{"line": 2, "mode": "require", "specifier": "./real.cjs"}])
        self.assertEqual(graph.references("function f() { throw /require('fake')/; }"), [])

    def test_division_after_values_and_postfix_operators_keeps_real_references(self):
        for value in ["ready++", "ready--", "'return'", "'='", "obj.return", "obj.if(ready)", "(ready)", "/ready/"]:
            with self.subTest(value=value):
                self.assertEqual([r["specifier"] for r in graph.references(f"const n = {value} / require('./real.cjs') / 2;")], ["./real.cjs"])
        self.assertEqual([r["specifier"] for r in graph.references("if (ready) 'value' / require('./real.cjs');")], ["./real.cjs"])

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

    def test_semantic_anchors_relocate_and_warn_or_fail_by_mode(self):
        manifest = self.relation_fixture()
        self.add({"apps/ui/main.mjs": "// moved\n\nrun();\n", "tools/system-map/relations.json": json.dumps(manifest)})
        data = self.build();edge = data["graphs"][0]["edges"][0]
        self.assertEqual(edge["status"], "anchored")
        self.assertEqual(edge["evidence"][0]["line"], 3)
        self.assertIsNone(edge["evidence"][0]["url"], "dirty source must not claim an exact HEAD link")
        for args in [(), ("--strict-anchors",)]:
            self.assertEqual(self.invoke(*args)[0], 0)
            self.assertEqual(self.artifact_data()["graphs"][0]["edges"][0]["evidence"][0]["line"], 3)
        for text, status in [("different();", "missing"), ("run();\nrun();", "ambiguous")]:
            (self.root / "apps/ui/main.mjs").write_text(text, encoding="utf-8")
            data = self.build();proof = data["graphs"][0]["edges"][0]["evidence"][0]
            self.assertEqual(proof["status"], status)
            self.assertIsNone(proof["line"])
            self.assertEqual(len(data["issues"]), 1)
            for args, expected in [((), 0), (("--strict-anchors",), 1)]:
                with self.subTest(status=status, args=args):
                    code, out, error = self.invoke(*args)
                    self.assertEqual(code, expected)
                    self.assertIn("VARNING:" if not args else "FEL:", error)
                    self.assertIn("behöver översyn", error)
                    self.assertIn("1 varningar" if not args else "1 fel", out)
                    artifact = self.artifact_data()
                    edge = artifact["graphs"][0]["edges"][0]
                    self.assertEqual(edge["status"], "needs-review")
                    self.assertEqual(edge["evidence"][0]["status"], status)
                    for field in ["line", "url", "local"]:
                        self.assertIsNone(edge["evidence"][0][field])
                    self.assertEqual(len(artifact["referenceWarnings"]), 0 if args else 1)
                    self.assertEqual(len(artifact["referenceErrors"]), 1 if args else 0)
                    html = (self.root / ".cache/system-map/index.html").read_text(encoding="utf-8")
                    fallback = html.split("<noscript>", 1)[1].split("</noscript>", 1)[0]
                    self.assertIn("Handgranskat kodankare behöver översyn", "".join(Elements(fallback).text))

    def test_quote_only_anchor_change_warns_and_does_not_hide_reference_errors(self):
        manifest = self.relation_fixture()
        manifest["graphs"][0]["edges"][0]["evidence"][0]["match"] = "run('value');"
        self.add({"apps/ui/main.mjs": 'run("value");', "tools/system-map/relations.json": json.dumps(manifest)})
        self.assertEqual(self.invoke()[0], 0)
        self.assertEqual(self.artifact_data()["stats"]["stale"], 1)
        self.assertEqual(self.invoke("--strict-anchors")[0], 1)
        self.write_table(code="[Saknad](missing.py)")
        for args in [(), ("--strict-anchors",)]:
            code, _, error = self.invoke(*args)
            self.assertEqual(code, 1)
            self.assertIn("FEL: START-HERE.md:", error)
            self.assertIn("missing.py — Saknas i Git-revisionen", error)

    def test_obsolete_relations_can_be_removed_without_preserving_counts_or_names(self):
        manifest = self.relation_fixture()
        self.add({"apps/ui/main.mjs": "run();", "tools/system-map/relations.json": json.dumps(manifest)})
        self.assertEqual(self.build()["stats"]["semantic"], 1)
        manifest["graphs"][0]["edges"] = []
        self.write_relations(manifest)
        self.assertEqual(self.build()["stats"]["semantic"], 0)
        self.assertEqual(self.invoke()[0], 0)
        manifest["graphs"] = []
        self.write_relations(manifest)
        self.assertEqual(self.invoke()[0], 0)


if __name__ == "__main__":
    unittest.main()
