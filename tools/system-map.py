#!/usr/bin/env python3
"""Build a local system atlas from START-HERE, tracked JS/TS and reviewed relations.

Run: python tools/system-map.py [--output .cache/system-map/index.html]
Requires Python 3.10+ and Git. Input keeps the four existing table columns;
only relative Markdown links without query/fragment are file-verified.
Exit 0: rendered (warnings allowed), 1: rendered with broken references or strict
anchor failures, 2: invalid input/no output. Use --strict-anchors for map review.
Semantic relations are re-anchored; static references do not prove runtime use or test coverage.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from html import escape
import importlib.util
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit

HEADERS = ("Produktväg / ansvar", "Kod att börja i", "Data och drift", "Verifiering av gränsen")
SOURCE = "START-HERE.md"
TOKENS = re.compile(r"\[([^\[\]\n]+)\]\(([^()\s]+)\)|`([^`\n]+)`|\*\*([^*\n]+)\*\*")


def git(root: Path, *args: str, codes: tuple[int, ...] = (0,)) -> subprocess.CompletedProcess:
    result = subprocess.run(["git", "-C", str(root), *args], capture_output=True, timeout=30)
    if result.returncode not in codes:
        raise ValueError(f"Git-kommandot {args[0]} misslyckades (kod {result.returncode}).")
    return result


def read_rows(root: Path) -> list[tuple[int, list[str]]]:
    table, in_section, fenced = [], False, False
    with (root / SOURCE).open(encoding="utf-8-sig") as source:
        for number, raw in enumerate(source, 1):
            line = raw.strip()
            if not in_section:
                in_section = bool(re.match(r"^## Systemkarta(?:\s|:|$)", line))
                continue
            if line.startswith("```"):
                fenced = not fenced
            if fenced:
                continue
            if re.match(r"^#{1,2} ", line):
                break
            if line.startswith("|"):
                if not line.endswith("|"):
                    raise ValueError(f"{SOURCE}:{number}: tabellraden måste sluta med |.")
                cells = [cell.strip().replace(r"\|", "|") for cell in re.split(r"(?<!\\)\|", line[1:-1])]
                if len(cells) != 4 or not all(cells):
                    raise ValueError(f"{SOURCE}:{number}: förväntade fyra ifyllda kolumner; använd \\| i celltext.")
                table.append((number, cells))
    if not in_section or len(table) < 3 or tuple(table[0][1]) != HEADERS:
        raise ValueError(f"{SOURCE}: saknar Systemkarta med de fyra befintliga kolumnrubrikerna och minst en datarad.")
    if not all(re.fullmatch(r":?-{3,}:?", cell) for cell in table[1][1]):
        raise ValueError(f"{SOURCE}:{table[1][0]}: ogiltig avskiljarad under kolumnrubrikerna.")
    return table[2:]


def local_reference(root: Path, target: str) -> tuple[str, Path]:
    url = urlsplit(target)
    path = unquote(url.path)
    parts = PurePosixPath(path).parts
    if (url.scheme or url.netloc or url.query or url.fragment or not parts or path.startswith("/")
            or "\\" in path or ":" in path or any(part in ("..", ".git", ".claude", ".codex", "arkiv", "random-stuff-jakob") or part.startswith(".env") for part in parts)
            or any(ord(char) < 32 for char in path)):
        raise ValueError("kräver en relativ reposökväg utan protokoll, query, ankare eller privata konfigurationsfiler")
    relative = PurePosixPath(path).as_posix().rstrip("/")
    try:
        resolved = (root / relative).resolve()
    except (OSError, RuntimeError) as error:
        raise ValueError("sökvägen kunde inte lösas") from error
    if not resolved.is_relative_to(root.resolve()):
        raise ValueError("sökvägen lämnar repot")
    if resolved != root.resolve() / relative or relative.startswith("random-stuff-jakob/jakob-docs/arkiv/"):
        raise ValueError("länkade eller privata arkivsökvägar stöds inte")
    return relative, resolved


def collect_references(root: Path, rows: list, revision: str) -> dict[str, tuple[str, str | None]]:
    targets = {match[2] for _, cells in rows for cell in cells for match in TOKENS.finditer(cell) if match[2]}
    references, paths = {}, {}
    for target in sorted(targets):
        try:
            paths[target] = local_reference(root, target)
        except ValueError as error:
            references[target] = (f"Osäker/otydlig referens: {error}", None)
    # Literal pathspecs: table input must not become Git options or wildcard queries.
    requested = [SOURCE, *(relative for relative, _ in paths.values())]
    tracked = git(root, "--literal-pathspecs", "ls-tree", "-r", "-z", "--name-only", revision, "--", *requested).stdout.decode("utf-8").split("\0")
    if SOURCE not in tracked:
        raise ValueError(f"{SOURCE} är inte spårad i källrevisionen.")
    for target, (relative, resolved) in paths.items():
        is_file, is_dir = relative in tracked, any(name.startswith(relative + "/") for name in tracked)
        if not (is_file or is_dir):
            references[target] = ("Saknas i Git-revisionen", None)
        elif not (resolved.is_file() if is_file else resolved.is_dir()):
            references[target] = ("Git-spårad men saknas lokalt", None)
        else:
            references[target] = ("Git-spårad fil finns lokalt" if is_file else "Mapp med Git-spårat innehåll finns lokalt", resolved.as_uri())
    return references


def inline(text: str, references: dict) -> str:
    output, start = [], 0
    for token in TOKENS.finditer(text):
        output.append(escape(text[start:token.start()]))
        label, target, code, strong = token.groups()
        if target:
            status, href = references[target]
            title = escape(f"{target} — {status}", quote=True)
            if href:
                output.append(f'<a class="ref" href="{escape(href, quote=True)}" title="{title}" target="_blank" rel="noopener">{escape(label)} <span aria-label="filreferens verifierad">✓</span></a>')
            else:
                output.append(f'<span class="broken" title="{title}">{escape(label)} <strong>⚠ {escape(status)}</strong></span>')
        elif code:
            output.append(f"<code>{escape(code)}</code>")
        else:
            output.append(f"<strong>{escape(strong)}</strong>")
        start = token.end()
    output.append(escape(text[start:]))
    return "".join(output)


def render(root: Path, *, strict_anchors: bool = False) -> tuple[str, list[str], list[str]]:
    rows = read_rows(root)
    revision = git(root, "rev-parse", "--verify", "HEAD").stdout.decode().strip()
    dirty = git(root, "diff", "--no-ext-diff", "--no-textconv", "--quiet", "HEAD", "--", SOURCE, codes=(0, 1)).returncode == 1
    references = collect_references(root, rows, revision)
    errors, warnings, cards = [], [], []
    for index, (line, cells) in enumerate(rows, 1):
        for cell in cells:
            # Refuse half-parsed Markdown links instead of silently losing a reference.
            remainder = TOKENS.sub("", cell)
            if "](" in remainder:
                raise ValueError(f"{SOURCE}:{line}: ogiltig Markdownlänk; använd [etikett](relativ/reposökväg).")
            for token in TOKENS.finditer(cell):
                if token[2] and references[token[2]][1] is None:
                    errors.append(f"{SOURCE}:{line}: {token[2]} — {references[token[2]][0]}")
        plain_code = [token[3] for token in TOKENS.finditer(cells[1]) if token[3]]
        if plain_code or not any(token[2] for token in TOKENS.finditer(cells[1])):
            warnings.append(f"{SOURCE}:{line}: kodkolumnen innehåller olänkad text; endast Markdownlänkar filverifieras.")
        name, separator, description = cells[0].partition(":")
        content = "".join(f'<section class="{kind}"><h3>{title}</h3><p>{inline(cell, references)}</p></section>' for kind, title, cell in zip(("code", "data", "checks"), HEADERS[1:], cells[1:]))
        note = '<p class="unverified">Olänkad kodtext är inte filverifierad.</p>' if plain_code else ""
        cards.append(f'<details class="branch" open><summary><span class="number">{index:02}</span><span>{inline(name, references)}</span><span class="fold" aria-hidden="true">⌄</span></summary><div class="branch-body"><p class="responsibility">{inline(description.strip() if separator else cells[0], references)}</p>{content}{note}<footer>Dokumenterat på rad {line} i <a href="{(root / SOURCE).as_uri()}">{SOURCE}</a></footer></div></details>')
    verified = sum(href is not None for _, href in references.values())
    source_state = "Arbetskopian av källan är ändrad efter denna revision." if dirty else "Källan motsvarar Git-revisionen."
    support = Path(__file__).resolve().parent / "system-map"
    spec = importlib.util.spec_from_file_location("system_map_graph", support / "graph.py")
    graph_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(graph_module)
    data = graph_module.build_graph(root, revision, root / "tools/system-map/relations.json")
    for issue in data["issues"]:
        (errors if strict_anchors else warnings).append(f"Handgranskat kodankare behöver översyn: {issue['graph']}/{issue['edge']} — {issue['path']} ({issue['reason']}).")
    issues = "".join(f"<li>{escape(issue)}</li>" for issue in [*errors, *warnings])
    issue_box = f'<details class="issues" {"open" if errors or warnings else ""}><summary>{len(errors)} fel · {len(warnings)} varningar i underlaget</summary><ul>{issues}</ul></details>' if issues else ""
    data["contracts"] = [{"id": f"contract-{i}", "name": cells[0].partition(":")[0], "responsibility": cells[0],
                          "line": line, "code": inline(cells[1], references), "data": inline(cells[2], references),
                          "checks": inline(cells[3], references),
                          "files": [unquote(m[2]) for m in TOKENS.finditer(cells[1]) if m[2] and references[m[2]][1]],
                          "tests": [unquote(m[2]) for m in TOKENS.finditer(cells[3]) if m[2] and references[m[2]][1] and graph_module.is_test(unquote(m[2]))]}
                         for i, (line, cells) in enumerate(rows)]
    data["generated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    data["sourceDirty"] = dirty
    data["referenceErrors"] = errors
    data["referenceWarnings"] = warnings
    encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    values = {"STYLE": (support / "style.css").read_text(encoding="utf-8"),
              "SCRIPT": (support / "app.js").read_text(encoding="utf-8"), "DATA": encoded, "SOURCE": escape(f"{SOURCE} · Systemkarta · rader {rows[0][0]}–{rows[-1][0]}"),
              "REVISION": escape(revision), "SHORT": escape(revision[:12]), "SOURCE_STATE": source_state,
              "DIRTY": " · ändrad arbetskopia" if dirty else "", "TIME": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
              "COUNTS": f"{len(rows)} ansvarsområden · {verified}/{len(references)} filreferenser verifierade",
              "ISSUES": issue_box, "CARDS": "".join(cards)}
    return re.sub(r"@@([A-Z_]+)@@", lambda token: values[token[1]], (support / "template.html").read_text(encoding="utf-8")), errors, warnings


def main(argv: list[str] | None = None, *, root: Path | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(".cache/system-map/index.html"), help="Fristående HTML-fil (relativt repot).")
    parser.add_argument("--strict-anchors", action="store_true", help="Ge exit 1 även för kodankare som behöver översyn (kartgranskning).")
    args = parser.parse_args(argv)
    root = (root or Path(__file__).resolve().parent.parent).resolve()
    try:
        html, errors, warnings = render(root, strict_anchors=args.strict_anchors)
        output = (root / args.output).resolve()
        if output.suffix.lower() != ".html" or not output.is_relative_to(root / ".cache"):
            raise ValueError("Utdata måste vara en .html-fil under repots .cache/; produktfiler får inte skrivas över.")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(html, encoding="utf-8")
        print(f"Skapade {output} ({len(errors)} fel, {len(warnings)} varningar).")
        for label, items in (("FEL", errors), ("VARNING", warnings)):
            for issue in items:
                print(f"{label}: {issue}", file=sys.stderr)
        return 1 if errors else 0
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"Systemkarta: {error} Ingen karta skrevs.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
