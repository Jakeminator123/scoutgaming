"""Bounded, dependency-free JS/TS reference inventory. Not a compiler or call graph.

Only tracked, non-ignored source is read. No arbitrary source excerpts are emitted.
Literal imports are syntax references, never evidence of runtime execution.
"""
from __future__ import annotations

from collections import Counter
import importlib.util
import json
from pathlib import Path, PurePosixPath
import posixpath
import re
import subprocess
from urllib.parse import quote

ROOTS = {"apps", "packages", "services", "test", "tools", "ops"}
EXTENSIONS = {".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"}
OTHER_EXTENSIONS = {".py", ".sql", ".sh", ".bash", ".ps1", ".css", ".scss", ".json", ".html", ".yml", ".yaml", ".toml", ".dockerfile"}
MAX_BYTES = 1_000_000
WORD = re.compile(r"[A-Za-z_$][\w$]*")
OPERATORS = re.compile(r"\.\.\.|>>>=?|\*\*=?|&&=?|\|\|=?|\?\?=?|===?|!==?|<<=?|>>=?|=>|\+\+|--|\?\.|[+*/%&|^!<>=-]=?")
EXPRESSION_PREFIXES = {"=", "(", "[", ":", ",", "?", "!", "~", ";", "{", "=>", "...",
                       "+", "-", "*", "/", "%", "**", "&", "|", "^", "&&", "||", "??",
                       "<", ">", "<=", ">=", "==", "!=", "===", "!==", "<<", ">>", ">>>",
                       "+=", "-=", "*=", "/=", "%=", "**=", "&=", "|=", "^=", "&&=", "||=", "??=", "<<=", ">>=", ">>>="}
EXPRESSION_KEYWORDS = {"return", "throw", "case", "delete", "void", "typeof", "new", "in", "instanceof", "yield", "await", "else", "do"}


def run(root, *args):
    result = subprocess.run(["git", "-C", str(root), *args], capture_output=True, timeout=30)
    if result.returncode:
        raise ValueError(f"Git-inventering misslyckades: {args[0]}")
    return result.stdout.decode("utf-8").rstrip("\n")


def safe_path(root, path):
    parts = PurePosixPath(path).parts
    if (not parts or path.startswith(("/", "\\")) or ":" in path or "\\" in path
            or any(p in {"..", ".git", "node_modules", ".claude", ".codex", "arkiv", "random-stuff-jakob"}
                   or p.startswith(".env") for p in parts)):
        return False
    resolved = (root / path).resolve()
    return resolved.is_relative_to(root.resolve()) and resolved == root.resolve() / path


def inventory(root):
    tracked = set(run(root, "ls-files", "-z", "--cached").split("\0")) - {""}
    args = ["ls-files", "-z", "--cached", "--ignored", "--exclude-standard"]
    if (root / ".ignore").is_file():
        args.append("--exclude-from=.ignore")
    ignored = set(run(root, *args).split("\0")) - {""}
    allowed = {p for p in tracked - ignored if safe_path(root, p)}
    sources, skipped = {}, Counter()
    for path in sorted(allowed):
        if path.split("/")[0] not in ROOTS or PurePosixPath(path).suffix not in EXTENSIONS:
            continue
        file = root / path
        if not file.is_file():
            skipped["saknas lokalt"] += 1
        elif file.stat().st_size > MAX_BYTES:
            skipped["över 1 MB"] += 1
        else:
            try:
                text = file.read_text(encoding="utf-8-sig")
                if "\0" in text:
                    skipped["binär"] += 1
                else:
                    sources[path] = text
            except UnicodeError:
                skipped["ej UTF-8"] += 1
    dirty = set(run(root, "diff", "--no-ext-diff", "--no-textconv", "--name-only", "-z", "HEAD").split("\0")) - {""}
    return sources, allowed, {"tracked": len(tracked), "excluded": len(tracked - allowed),
                              "scanned": len(sources), "skipped": dict(skipped)}, dirty


def tokens(text):
    """Small lexical scanner: comments/strings/templates/regex are opaque tokens.

    Template interpolations are intentionally opaque (reported as dynamic where
    used by import). This conservative scanner does not resolve lexical bindings.
    """
    def quoted_end(start):
        quote_char, cursor = text[start], start + 1
        while cursor < len(text):
            if text[cursor] == "\\":
                cursor += 2
            elif text[cursor] == quote_char:
                return cursor + 1
            elif quote_char == "`" and text.startswith("${", cursor):
                cursor += 2
                depth = 1
                while cursor < len(text) and depth:
                    if text[cursor] in "'\"`":
                        cursor = quoted_end(cursor)
                    elif text.startswith("/*", cursor):
                        end = text.find("*/", cursor + 2)
                        cursor = len(text) if end < 0 else end + 2
                    elif text.startswith("//", cursor):
                        end = text.find("\n", cursor + 2)
                        cursor = len(text) if end < 0 else end
                    else:
                        depth += (text[cursor] == "{") - (text[cursor] == "}")
                        cursor += 1
            else:
                cursor += 1
        return cursor

    result, i, line, parens, after_control = [], 0, 1, [], False
    while i < len(text):
        char, start_line = text[i], line
        if char.isspace():
            line += char == "\n"
            i += 1
            continue
        if text.startswith("//", i):
            end = text.find("\n", i)
            i = len(text) if end < 0 else end
            continue
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            end = len(text) if end < 0 else end + 2
            line += text[i:end].count("\n")
            i = end
            continue
        if char in "'\"`":
            start, quote_char = i, char
            i = quoted_end(start)
            raw = text[start:i]
            line += raw.count("\n")
            kind = "opaque" if quote_char == "`" or "\\" in raw or not raw.endswith(quote_char) else "string"
            result.append((kind, raw[1:-1], start_line))
            after_control = False
            continue
        # Regex literal in expression position; never treat its contents as code.
        # Token kinds matter: "return" / require(...) is division, not a regex.
        previous = result[-1][1] if result else "="
        previous_kind = result[-1][0] if result else "punct"
        keyword = previous_kind == "word" and (len(result) < 2 or result[-2][1] not in {".", "?."})
        expression_start = (previous_kind == "punct" and previous in EXPRESSION_PREFIXES
                            or keyword and previous in EXPRESSION_KEYWORDS)
        if char == "/" and (after_control or expression_start):
            start, in_class = i, False
            i += 1
            while i < len(text) and text[i] != "\n":
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == "[": in_class = True
                if text[i] == "]": in_class = False
                if text[i] == "/" and not in_class:
                    i += 1
                    while i < len(text) and text[i].isalpha(): i += 1
                    break
                i += 1
            result.append(("opaque", "regex", start_line))
            after_control = False
            continue
        after_control = False
        word = WORD.match(text, i)
        if word:
            result.append(("word", word[0], line))
            i += len(word[0])
        else:
            operator = OPERATORS.match(text, i)
            op = operator[0] if operator else char
            if op == "(": parens.append(keyword and previous in {"if", "while", "for", "switch", "with", "catch"})
            if op == ")" and parens: after_control = parens.pop()
            result.append(("punct", op, line))
            i += len(op)
    return result


def references(text):
    stream = tokens(text)
    found = []
    for index, (kind, value, line) in enumerate(stream):
        if kind != "word" or value not in {"import", "export", "require"}:
            continue
        if index and stream[index - 1][1] in {".", "?."}:
            continue
        tail = stream[index + 1:index + 160]
        if not tail or tail[0][1] in {".", ":"}:
            continue
        if tail[0][1] == "(" and value in {"import", "require"}:
            literal = len(tail) > 2 and tail[1][0] == "string" and tail[2][1] in {")", ","}
            found.append({"line": line, "mode": "dynamic" if value == "import" else "require",
                          "specifier": tail[1][1] if literal else None})
        elif value == "import" and tail[0][0] == "string":
            found.append({"line": line, "mode": "import", "specifier": tail[0][1]})
        elif value in {"import", "export"}:
            # An import/export-from declaration cannot cross ';' or a new declaration.
            for offset, token in enumerate(tail):
                if token[1] == ";" or (offset and token[1] in {"import", "export", "const", "function"}):
                    break
                if token[:2] == ("word", "from") and offset + 1 < len(tail):
                    spec = tail[offset + 1]
                    if spec[0] == "string":
                        found.append({"line": line, "mode": "type" if tail[0][1] == "type" else value,
                                      "specifier": spec[1]})
                    break
    return found


def module_for(path):
    parts = path.split("/")
    if parts[0] in {"apps", "packages"} and len(parts) > 1:
        return "/".join(parts[:2])
    if path.startswith("services/openclaw/lab/"):
        return "services/openclaw/lab"
    if parts[0] == "services" and len(parts) > 1:
        return "/".join(parts[:2])
    return parts[0]


def is_test(path):
    return bool(re.search(r"(?:^|/)(?:test|tests|__tests__)(?:/|$)|\.(?:test|spec)\.", path))


def test_role(path):
    if not is_test(path):
        return None
    return "support" if re.search(r"(?:^|/)(?:fixtures?|helpers?|support|utils)(?:/|\.)", path) else "test-area"


def resolver_configs(root, allowed):
    aliases, packages = [], {}
    for path in sorted(allowed):
        if PurePosixPath(path).name not in {"package.json", "tsconfig.json", "jsconfig.json"}:
            continue
        if path.split("/")[0] not in ROOTS or not (root / path).is_file():
            continue
        try:
            data = json.loads((root / path).read_text(encoding="utf-8-sig"))
        except (ValueError, OSError):
            continue  # JSONC/extends are unsupported; unresolved aliases remain visible.
        base = posixpath.dirname(path)
        if path.endswith("package.json"):
            name = data.get("name")
            if isinstance(name, str):
                packages[name] = (base, data.get("exports"), data.get("main"))
        else:
            compiler = data.get("compilerOptions", {})
            targets = compiler.get("paths", {})
            if isinstance(targets, dict):
                aliases.append((base, posixpath.normpath(posixpath.join(base, compiler.get("baseUrl", "."))), targets))
    return sorted(aliases, key=lambda item: -len(item[0])), packages


def resolve_spec(source, spec, sources, allowed, aliases, packages):
    if spec is None:
        return None, "dynamiskt uttryck"
    if any(c in spec for c in "\\?#%\x00") or re.match(r"^[a-zA-Z]+:", spec) or spec.startswith("/"):
        return None, "inbyggd/extern" if spec.startswith("node:") else "URL eller specialsyntax"
    candidate = None
    if spec.startswith("."):
        candidate = posixpath.normpath(posixpath.join(posixpath.dirname(source), spec))
    else:
        for base, target_base, paths in aliases:
            if not source.startswith(base + "/"):
                continue
            for pattern, targets in paths.items():
                if not isinstance(targets, list) or not targets or not isinstance(targets[0], str): continue
                if "*" in pattern:
                    left, right = pattern.split("*", 1)
                    if spec.startswith(left) and spec.endswith(right):
                        middle = spec[len(left):len(spec)-len(right) if right else None]
                        candidate = posixpath.normpath(posixpath.join(target_base, targets[0].replace("*", middle)))
                elif pattern == spec:
                    candidate = posixpath.normpath(posixpath.join(target_base, targets[0]))
                if candidate: break
            break  # nearest config; no guessing through inherited aliases
        if candidate is None:
            name = "/".join(spec.split("/")[:2]) if spec.startswith("@") else spec.split("/")[0]
            if name in packages:
                base, exports, main = packages[name]
                sub = spec[len(name):].lstrip("/")
                target = exports.get("./" + sub if sub else ".") if isinstance(exports, dict) else exports if not sub else None
                if exports is not None and not isinstance(target, str):
                    return None, "villkorad paketexport"
                candidate = posixpath.normpath(posixpath.join(base, target or sub or main or "index"))
            else:
                return None, "inbyggd/extern" if not spec.startswith(("@/", "~/", "#")) else "olöst alias"
    options = [candidate]
    suffix = PurePosixPath(candidate).suffix
    if not suffix:
        options += [candidate + ext for ext in (".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".cjs")]
        options += [candidate + "/index" + ext for ext in (".ts", ".tsx", ".mjs", ".js")]
    elif suffix in {".js", ".jsx", ".mjs"} and candidate not in allowed:
        options += [candidate[:-len(suffix)] + ext for ext in (".ts", ".tsx", ".mts")]
    matches = [p for p in options if p in sources]
    if matches:
        return matches[0], None
    if any(p in allowed for p in options):
        return None, "mål utanför JS/TS-inventeringen"
    return None, "olöst lokal referens"


def proof_link(root, path, line, revision, dirty):
    return {"path": path, "line": line, "local": (root / path).as_uri(),
            "url": None if path in dirty else "https://github.com/Jakeminator123/scoutgaming/blob/" + revision + "/" + quote(path, safe="/") + f"#L{line}",
            "dirty": path in dirty}


def read_relations(root, manifest):
    """Validate the data consumed by the viewer, without locking graph contents."""
    if not manifest.is_file():
        raise ValueError("tools/system-map/relations.json saknas; manifestet krävs för handgranskade samband.")
    data = json.loads(manifest.read_text(encoding="utf-8"))

    def require(condition, location, expected):
        if not condition:
            raise ValueError(f"relations.json: {location} måste vara {expected}.")

    def strings(item, fields, location):
        require(isinstance(item, dict), location, "ett objekt")
        for field in fields:
            require(isinstance(item.get(field), str) and bool(item[field].strip()), f"{location}.{field}", "en icke-tom sträng")

    def members(items, location):
        require(isinstance(items, list), location, "en lista")
        ids = set()
        for index, item in enumerate(items):
            here = f"{location}[{index}]"
            strings(item, ("id",), here)
            require(item["id"] not in ids, f"{here}.id", "unik i listan")
            ids.add(item["id"])
        return ids

    require(isinstance(data, dict), "rot", "ett objekt")
    require(type(data.get("version")) is int and data["version"] == 1, "version", "1")
    graphs = data.get("graphs")
    members(graphs, "graphs")
    for index, graph in enumerate(graphs):
        here = f"graphs[{index}]"
        strings(graph, ("title", "category"), here)
        require(isinstance(graph.get("note", ""), str), f"{here}.note", "en sträng")
        node_ids = members(graph.get("nodes"), f"{here}.nodes")
        members(graph.get("edges"), f"{here}.edges")
        for n, node in enumerate(graph["nodes"]):
            location = f"{here}.nodes[{n}]"
            strings(node, ("label", "place"), location)
            for coordinate in ("col", "row"):
                require(type(node.get(coordinate)) is int, f"{location}.{coordinate}", "ett heltal")
        for e, edge in enumerate(graph["edges"]):
            location = f"{here}.edges[{e}]"
            strings(edge, ("source", "target", "kind", "label", "explanation"), location)
            for endpoint in ("source", "target"):
                require(edge[endpoint] in node_ids, f"{location}.{endpoint}", "ett nod-id i samma graf")
            require(type(edge.get("conditional")) is bool, f"{location}.conditional", "en boolesk flagga")
            evidence = edge.get("evidence")
            require(isinstance(evidence, list) and bool(evidence), f"{location}.evidence", "en lista med minst ett kodankare")
            for p, proof in enumerate(evidence):
                proof_location = f"{location}.evidence[{p}]"
                strings(proof, ("path", "match"), proof_location)
                require(safe_path(root, proof["path"]), f"{proof_location}.path", "en tillåten relativ reposökväg")
                require(len(proof["match"].splitlines()) == 1, f"{proof_location}.match", "en enda kodrad")
    return graphs


def semantic_graphs(root, manifest, sources, revision, dirty):
    graphs, issues = read_relations(root, manifest), []
    for graph in graphs:
        for edge in graph["edges"]:
            edge["level"] = "semantic"
            kind = edge["kind"]
            edge["type"] = ("http" if kind in {"HTTP", "WebSocket"} else "data" if kind in {"SQL", "Media", "Provideranrop"}
                            else "import" if "import" in kind.lower() else "call")
            edge["status"] = "anchored"
            for proof in edge["evidence"]:
                path, match = proof["path"], proof.pop("match")
                lines = [i for i, line in enumerate(sources.get(path, "").splitlines(), 1) if match.strip() == line.strip()]
                if len(lines) != 1:
                    proof.update({"line": None, "status": "ambiguous" if lines else "missing", "url": None, "local": None})
                    edge["status"] = "needs-review"
                    issues.append({"graph": graph["id"], "edge": edge["id"], "path": path, "reason": proof["status"]})
                else:
                    proof.update(proof_link(root, path, lines[0], revision, dirty))
                    proof["status"] = "matched"
        for node in graph["nodes"]:
            related = [edge for edge in graph["edges"] if node["id"] in {edge["source"], edge["target"]}]
            node["files"] = sorted({p["path"] for e in related for p in e["evidence"] if p["path"] in sources})
    return graphs, issues


def build_graph(root, revision, manifest):
    sources, allowed, stats, dirty = inventory(root)
    aliases, packages = resolver_configs(root, allowed)
    edges, unknown, external = [], [], 0
    nodes = [{"id": path, "label": PurePosixPath(path).name, "module": module_for(path), "test": is_test(path), "testRole": test_role(path),
              "dirty": path in dirty, "lines": text.count("\n") + 1} for path, text in sources.items()]
    for path, text in sources.items():
        for ref in references(text):
            target, reason = resolve_spec(path, ref["specifier"], sources, allowed, aliases, packages)
            if target:
                edges.append({"source": path, "target": target, "type": "test" if is_test(path) else "import",
                              "mode": ref["mode"], "line": ref["line"]})
            elif reason == "inbyggd/extern":
                external += 1
            else:
                # Never export unresolved expression text, tokens, URLs or private paths.
                unknown.append({"source": path, "line": ref["line"], "mode": ref["mode"], "reason": reason})
    spec = importlib.util.spec_from_file_location("system_map_controls", Path(__file__).with_name("controls.py"))
    controls_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(controls_module)
    controls, control_texts = controls_module.build_controls(root, allowed, sources,
        lambda path, line: proof_link(root, path, line, revision, dirty), {path for path in allowed if is_test(path)})
    graphs, issues = semantic_graphs(root, manifest, {**sources, **control_texts}, revision, dirty)
    other_files = [{"id": path, "module": module_for(path), "extension": PurePosixPath(path).suffix or "shell/config",
                    "status": "samband ej analyserade", "dirty": path in dirty}
                   for path in sorted(allowed - set(sources))
                   if PurePosixPath(path).suffix in OTHER_EXTENSIONS | EXTENSIONS or path.startswith(".githooks/") or PurePosixPath(path).name.startswith("Dockerfile")]
    stats.update({"edges": len(edges), "external": external, "unknown": len(unknown), "otherFiles": len(other_files),
                  "semantic": sum(len(g["edges"]) for g in graphs), "stale": len(issues),
                  "tests": sum(n["test"] for n in nodes), "dirty": len(set(sources) & dirty)})
    return {"nodes": nodes, "otherFiles": other_files, "edges": edges, "unknown": unknown, "graphs": graphs, "issues": issues, "controls": controls,
            "stats": stats, "revision": revision, "root": root.as_uri(), "dirtyFiles": sorted(dirty & allowed),
            "limits": "Statisk JS/TS-referensinventering, inte AST-, körnings- eller testtäckningsanalys. Kommentarer, strängar och mallsträngars innehåll hoppas över. require kan vara lokalt ombundet. JSONC, ärvda tsconfig-alias, villkorade exports och beräknade imports kan vara olösta. Frånvaro av kant betyder inte död kod."}
