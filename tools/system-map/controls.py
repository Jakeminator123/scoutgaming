"""Read-only, bounded references in tracked delivery controls; never a shell executor."""
from pathlib import PurePosixPath
import posixpath
import re
import shlex

IGNORE_NAMES = {".gitignore", ".ignore", ".cursorignore", ".dockerignore"}
CONTROL_TOOLS = {"tools/precommit-checks.mjs", "tools/ci-changes.mjs", "tools/merge-pr.mjs",
                 "tools/push-github-work.mjs", "tools/security-status.mjs", "tools/repository-policy.json",
                 "tools/check-orphan-tests.mjs", "tools/regression-group.mjs"}
IGNORE_MEANING = {
    ".gitignore": "Git: oregistrerade filer undantas normalt. Redan spårade filer försvinner inte ur Git.",
    ".ignore": "Textsökning: ripgrep följer denna fil. Git, bygg och deploy påverkas inte.",
    ".cursorignore": "Cursor: gräns för AI-åtkomst. Terminal/MCP och OS-behörigheter påverkas inte.",
    ".dockerignore": "Docker: begränsar byggkontexten. Effekten beror på vald kontext och Dockerfile.",
}
PATH_TOKEN = re.compile(r"(?<![\w:/.-])(?:\./|\.\./)*[\w.-]+(?:/[\w.-]+)*(?![\w/.-])")
SAFE_ARGUMENT = re.compile(r"[A-Za-z0-9_./*-]+\Z")


def category(path):
    name = PurePosixPath(path).name
    if name in IGNORE_NAMES or name.endswith(".dockerignore"):
        return "Ignoreringsgränser"
    if name in {"AGENTS.md", "CLAUDE.md"} or path == ".github/copilot-instructions.md" or path.startswith(".cursor/rules/") and path.endswith(".mdc"):
        return "Agentregler"
    if path.startswith(".githooks/"):
        return "Git-hookar"
    if path.startswith(".github/workflows/") and name.endswith((".yml", ".yaml")) or path.startswith(".github/actions/") and name in {"action.yml", "action.yaml"}:
        return "GitHub CI"
    if path in CONTROL_TOOLS:
        return "Leveransverktyg"
    return None


def bounded_text(root, path):
    file = root / path
    if not file.is_file() or file.stat().st_size > 1_000_000:
        return None
    try:
        text = file.read_text(encoding="utf-8-sig")
        return None if "\0" in text else text
    except UnicodeError:
        return None


def glob_matches(path, pattern):
    """Repo-relative shell/Node patterns only; **/ may match zero directories."""
    parts, i = [], 0
    while i < len(pattern):
        if pattern[i:i + 3] == "**/":
            parts.append("(?:.*/)?")
            i += 3
        elif pattern[i:i + 2] == "**":
            parts.append(".*")
            i += 2
        else:
            parts.append("[^/]*" if pattern[i] == "*" else re.escape(pattern[i]))
            i += 1
    return re.fullmatch("".join(parts), path) is not None


def test_commands(text, paths, proof, sources, control_texts):
    """Only recognized existing registry forms. No guessing from a test filename."""
    commands, edges = [], []
    registry = ".githooks/pre-commit-full"
    runner_line = next((i for i, line in enumerate(text.splitlines(), 1)
                        if re.fullmatch(r'\s*run_check "\$selected" "\$name" "\$seconds" node --test --test-concurrency=\d+ --test-reporter=spec "\$@"\s*', line)), None)
    for line_number, line in enumerate(text.splitlines(), 1):
        try:
            words = shlex.split(line, comments=True)
        except ValueError:
            continue
        if len(words) < 4 or words[0] not in {"run_node_tests", "run_check"}:
            continue
        suite, group = words[1:3]
        if not re.fullmatch(r"[a-z][a-z0-9-]*", suite) or not re.fullmatch(r"[a-z][a-z0-9-]*", group):
            continue
        mode, patterns = None, []
        if words[0] == "run_node_tests" and runner_line and all(SAFE_ARGUMENT.fullmatch(w) for w in words[3:]):
            mode, patterns = "node-test", words[3:]
        elif len(words) == 6 and words[0] == "run_check" and words[4] == "node" and SAFE_ARGUMENT.fullmatch(words[5]):
            mode, patterns = "node-script", [words[5]]
        elif len(words) == 11 and words[0] == "run_check" and words[4:9] == ["python", "-m", "unittest", "discover", "-s"] and words[10] == "-v" and SAFE_ARGUMENT.fullmatch(words[9]):
            mode, patterns = "python-discover", [words[9].rstrip("/") + "/test*.py"]
        if not mode:
            continue
        for path in sorted(paths):
            if not SAFE_ARGUMENT.fullmatch(path) or not any(glob_matches(path, pattern) for pattern in patterns):
                continue
            if mode == "node-test":
                command = f'node --test --test-concurrency=2 --test-reporter=spec "{path}"'
            elif mode == "node-script":
                command = f'node "{path}"'
            else:
                command = f'python -m unittest discover -s {words[9]} -v'
            requirements = []
            if mode == "node-test" and suite == "engine":
                requirements.append({"reason": "Kräver motorharness med isolerad PostgreSQL/TLS. Vanlig Node-körning och den direkta hooksviten kan hoppa över proven; inget kopierbart kommando erbjuds utan vald harnessmiljö.",
                                     "evidence": [proof(registry, line_number)]})
            browser_lines = [i for i, source_line in enumerate(sources.get(path, "").splitlines(), 1)
                             if "process.env.CROUPIER_BROWSER_FIXTURE_MODULE" in source_line]
            if mode == "node-test" and browser_lines:
                requirements.append({"reason": "Filen refererar till browser-fixturen. Chrome och installerad browserdriver måste sättas upp av browserharnessen; vanlig Node-körning eller hooksviten kan hoppa över acceptansen. Inget kopierbart kommando erbjuds här.",
                                     "evidence": [proof(path, browser_lines[0])]})
            if mode == "node-test" and path not in sources:
                requirements.append({"reason": "Provfilens innehåll kunde inte analyseras. Dess körförutsättningar är okända; inget riktat kommando erbjuds.", "evidence": []})
            if requirements and (suite == "engine" or browser_lines):
                marker = "tools/run-engine-qa.mjs" if suite == "engine" else "CROUPIER_BROWSER_FIXTURE_MODULE="
                for control_path, control_text in control_texts.items():
                    if not control_path.startswith(".github/workflows/"):
                        continue
                    for i, control_line in enumerate(control_text.splitlines(), 1):
                        if marker in control_line and not control_line.lstrip().startswith("#"):
                            requirements[0]["evidence"].append(proof(control_path, i))
            commands.append({"path": path, "suite": suite, "group": group, "mode": mode, "requirements": requirements,
                             "command": None if requirements else command,
                             "suiteCommand": None if requirements else f"sh {registry} {suite}",
                             "proof": proof(registry, line_number),
                             "runnerProof": proof(registry, runner_line) if mode == "node-test" else None})
            edges.append({"source": registry, "target": path, "line": line_number, "kind": "Provregistrering"})
    return commands, edges


def build_controls(root, allowed, sources, proof, test_paths):
    allowed = {path for path in allowed if (root / path).is_file()}
    controls, texts = [], {}
    for path in sorted(allowed):
        kind = category(path)
        if not kind:
            continue
        text = sources.get(path) if path in sources else bounded_text(root, path)
        if text is None:
            continue
        texts[path] = text
        item = {"id": path, "category": kind, "proof": proof(path, 1)}
        if kind == "Ignoreringsgränser":
            name = PurePosixPath(path).name
            item["meaning"] = IGNORE_MEANING.get(name, IGNORE_MEANING[".dockerignore"])
            item["patterns"] = [{"pattern": line.strip(), "line": i} for i, line in enumerate(text.splitlines(), 1)
                                if line.strip() and not line.lstrip().startswith("#")]
        controls.append(item)
    edges, seen = [], set()
    for path, text in texts.items():
        if category(path) == "Ignoreringsgränser":
            continue  # Ignore patterns are rules, not file dependencies.
        for line_number, line in enumerate(text.splitlines(), 1):
            if line.lstrip().startswith(("#", "//", "*")):
                continue
            for token in PATH_TOKEN.findall(line):
                candidates = [posixpath.normpath(posixpath.join(posixpath.dirname(path), token)), posixpath.normpath(token)]
                target = next((p for p in candidates if p in allowed), None)
                key = (path, target, line_number)
                if not target or target == path or key in seen:
                    continue
                seen.add(key)
                edges.append({"source": path, "target": target, "line": line_number,
                              "kind": "Dokumenthänvisning" if category(path) == "Agentregler" else "Literal sökvägsreferens"})
    commands, registrations = test_commands(texts.get(".githooks/pre-commit-full", ""), allowed & test_paths, proof, sources, texts)
    registered = {(edge["source"], edge["target"], edge["line"]) for edge in registrations}
    edges = [edge for edge in edges if (edge["source"], edge["target"], edge["line"]) not in registered]
    edges.extend(registrations)
    for index, edge in enumerate(edges):
        edge.update({"id": f"control-{index}", "type": "control", "level": "control", "label": edge["kind"],
                     "evidence": [proof(edge["source"], edge["line"]) ]})
    return ({"files": controls, "edges": edges, "commands": commands,
             "limits": "Utvalda Git-spårade regler, hookar, CI-filer och ignoreringsfiler. Literal sökväg är en referens, inte bevis på körning. Beräknade vägar, globbar och YAML/shell-semantik upplöses inte generellt. Personliga .codex/.claude-inställningar och ignorerade privata filer läses inte. Provkommandon kräver egen miljöbedömning och körs aldrig av Atlas."}, texts)
