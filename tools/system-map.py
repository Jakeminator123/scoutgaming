#!/usr/bin/env python3
"""Render START-HERE's Systemkarta table. Only local Git metadata is inspected.

Run: python tools/system-map.py [--output .cache/system-map/index.html]
Requires Python 3.10+ and Git. Input keeps the four existing table columns;
only relative Markdown links without query/fragment are file-verified.
Exit 0: rendered, 1: rendered with broken references, 2: invalid input/no output.
Relations and verification descriptions come from the document, not code analysis.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from html import escape
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
            or "\\" in path or ":" in path or any(part in ("..", ".git") or part.startswith(".env") for part in parts)
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


def render(root: Path) -> tuple[str, list[str], list[str]]:
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
    issues = "".join(f"<li>{escape(issue)}</li>" for issue in [*errors, *warnings])
    issue_box = f'<details class="issues" {"open" if errors else ""}><summary>{len(errors)} fel · {len(warnings)} varningar i underlaget</summary><ul>{issues}</ul></details>' if issues else ""
    verified = sum(href is not None for _, href in references.values())
    source_state = "Arbetskopian av källan är ändrad efter denna revision." if dirty else "Källan motsvarar Git-revisionen."
    values = {"STYLE": STYLE, "SCRIPT": SCRIPT, "SOURCE": escape(f"{SOURCE} · Systemkarta · rader {rows[0][0]}–{rows[-1][0]}"),
              "REVISION": escape(revision), "SHORT": escape(revision[:12]), "SOURCE_STATE": source_state,
              "DIRTY": " · ändrad arbetskopia" if dirty else "", "TIME": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
              "COUNTS": f"{len(rows)} ansvarsområden · {verified}/{len(references)} filreferenser verifierade",
              "ISSUES": issue_box, "CARDS": "".join(cards)}
    return re.sub(r"@@([A-Z_]+)@@", lambda token: values[token[1]], TEMPLATE), errors, warnings


STYLE = """
:root{color-scheme:light;--ink:#172b3d;--muted:#566a7a;--line:#cad8e0;--paper:#f3f6f8;--blue:#22577a;--green:#236b4d;--scale:1;font:15px/1.55 system-ui,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);height:100dvh;display:flex;flex-direction:column}
header,.toolbar,.issues,.notice{flex-shrink:0}
header{padding:24px 32px 16px;background:#fff;border-bottom:1px solid var(--line)}
.eyebrow{font-size:12px;letter-spacing:.14em;font-weight:750;color:var(--blue)}
h1{font-size:30px;line-height:1.2;margin:6px 0 8px}
header p{margin:5px 0;color:var(--muted)}
.meta{font-size:12px;overflow-wrap:anywhere}
.meta code{background:none;padding:0}
.source{margin-top:12px}
.toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:12px 32px;background:#fff;border-bottom:1px solid var(--line)}
button{font:inherit;cursor:pointer;border:1px solid #b4c6d2;border-radius:7px;background:white;color:var(--ink);padding:6px 12px;min-height:36px}
button:hover{background:#eaf2f7}
button:disabled{opacity:.45;cursor:default}
button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #1478b6;outline-offset:3px}
.zoom{display:flex;align-items:center;gap:8px;margin-left:auto}
output{min-width:48px;text-align:center;font-variant-numeric:tabular-nums}
.legend{font-size:12px;color:var(--muted)}
.legend b{color:var(--green)}
.viewport{overflow:auto;padding:24px;flex:1;min-height:220px}
.stage{position:relative;margin:auto}
.canvas{width:1224px;padding:8px 12px 28px;transform:scale(var(--scale));transform-origin:top left}
.root{width:max-content;max-width:90%;margin:0 auto 36px;padding:14px 30px;text-align:center;background:var(--ink);border-radius:12px;color:white;position:relative;box-shadow:0 6px 20px #172b3d15}
.root strong{display:block;font-size:19px}
.root small{color:#c5d7e4}
.root:after{content:"";position:absolute;bottom:-24px;left:50%;height:24px;border-left:2px dashed #7c9caf}
.branches{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:26px 22px;align-items:start;border-top:2px dashed #9eb4c2;padding-top:24px}
.branch{min-width:0;border:1px solid var(--line);border-radius:12px;background:white;position:relative;box-shadow:0 3px 10px #172b3d06}
.branch:before{content:"";position:absolute;top:-26px;left:50%;height:24px;border-left:2px dashed #9eb4c2}
.branch summary{display:flex;align-items:center;gap:10px;list-style:none;padding:17px 16px;cursor:pointer;font-size:17px;font-weight:700;border-radius:12px}
.branch summary::-webkit-details-marker{display:none}
.number{font-size:11px;color:var(--blue);padding:3px 6px;border:1px solid #bfd5e3;border-radius:5px}
.fold{margin-left:auto}
.branch:not([open]) .fold{transform:rotate(-90deg)}
.branch-body{padding:0 16px 14px}
.responsibility{margin:0 0 18px;color:#455f70;font-size:13px}
.branch section{position:relative;margin:14px 0 0 6px;padding:0 0 0 14px;border-left:3px solid #81a6c0}
.branch h3{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--blue);margin:0 0 5px}
.branch p{font-size:13px;margin-top:0;margin-bottom:0;overflow-wrap:anywhere}
.branch .data{border-color:#d6b66c}
.data h3{color:#825e16}
.branch .checks{border-color:#b8a0d1}
.checks h3{color:#705086}
a{color:#1e567b;text-decoration-thickness:1px;text-underline-offset:3px}
.ref span{color:var(--green);font-size:11px}
.broken{background:#fff0ec;color:#8e2917}
.broken strong{display:block;font-size:11px}
code{font:12px/1.5 ui-monospace,Consolas,monospace;background:#edf2f5;padding:1px 3px;border-radius:3px;overflow-wrap:anywhere}
.branch footer{margin-top:18px;padding-top:10px;border-top:1px solid #e4ebef;font-size:11px;color:var(--muted)}
.branch .unverified{margin-top:12px;color:#825e16;font-size:11px}
.issues{margin:12px 32px;padding:10px 15px;border:1px solid #d5b66d;border-radius:8px;background:#fff9e9;font-size:13px}
.issues summary{cursor:pointer;font-weight:650}
.issues ul{padding-left:20px}
.notice{padding:0 32px 16px;font-size:12px;color:var(--muted)}
@media(max-width:1100px){.canvas{width:820px}.branches{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){header{padding:20px 18px 14px}
h1{font-size:26px}
.toolbar{padding:10px 18px;gap:6px}
.zoom{margin-left:0}
.legend{width:100%}
.viewport{padding:12px;min-height:240px}.canvas{width:calc(100vw - 48px)}.branches{grid-template-columns:1fr}
.issues{margin:10px 18px}
.notice{padding:0 18px 16px}
}
@media print{body{display:block;height:auto}.toolbar{display:none}
.viewport{height:auto;overflow:visible;padding:0}
.canvas{transform:none;width:100%}
.stage{width:auto!important;height:auto!important}
.branches{grid-template-columns:repeat(2,minmax(0,1fr))}
.branch{break-inside:avoid}
.notice{padding-top:12px}
}

"""

SCRIPT = """
const viewport=document.querySelector('.viewport'),stage=document.querySelector('.stage'),canvas=document.querySelector('.canvas'),out=document.querySelector('output');
let scale=1;
function layout(){stage.style.width=(canvas.offsetWidth*scale)+'px';stage.style.height=(canvas.offsetHeight*scale)+'px';}
function zoom(next){scale=Math.min(1.6,Math.max(.25,next));canvas.style.setProperty('--scale',scale);out.value=Math.round(scale*100)+'%';document.querySelector('#minus').disabled=scale<=.25;document.querySelector('#plus').disabled=scale>=1.6;layout();}
document.querySelector('#minus').onclick=()=>zoom(scale-.1);document.querySelector('#plus').onclick=()=>zoom(scale+.1);
document.querySelector('#fit').onclick=()=>{zoom(Math.min(1,(viewport.clientWidth-48)/canvas.offsetWidth));viewport.scrollTo(0,0);};
for(const [id,open] of [['expand',true],['collapse',false]])document.getElementById(id).onclick=()=>{document.querySelectorAll('.branch').forEach(node=>node.open=open);layout();};
document.querySelectorAll('.branch').forEach(node=>node.addEventListener('toggle',layout));
new ResizeObserver(layout).observe(canvas);window.addEventListener('resize',layout);document.querySelector('#fit').click();
"""

TEMPLATE = """<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Scoutgaming · systemkarta</title><style>@@STYLE@@</style></head><body>
<header><div class="eyebrow">SCOUTGAMING / SYSTEMKARTA</div><h1>Från produktväg till kod och drift</h1>
<p>Dokumenterade ansvarsgränser – öppna ett område och följ dess kodreferenser.</p>
<details class="source"><summary class="meta">@@SOURCE@@ · revision <code>@@SHORT@@</code>@@DIRTY@@ · @@TIME@@</summary><p class="meta">Källrevision: <code>@@REVISION@@</code><br>@@SOURCE_STATE@@</p></details></header>
<nav class="toolbar" aria-label="Kartverktyg"><button id="expand">Expandera alla</button><button id="collapse">Fäll ihop alla</button>
<span class="legend"><b>✓</b> Git-spårad sökväg finns lokalt · streckade linjer = dokumenterade samband</span>
<div class="zoom"><button id="minus" aria-label="Zooma ut">−</button><output aria-live="polite" aria-label="Zoom">100%</output><button id="plus" aria-label="Zooma in">+</button><button id="fit">Anpassa bredd</button></div></nav>
@@ISSUES@@
<main class="viewport" aria-label="Systemkarta" tabindex="0"><div class="stage"><div class="canvas"><div class="root"><strong>Produktens ansvarsområden</strong><small>@@COUNTS@@</small></div><div class="branches">@@CARDS@@</div></div></div></main>
<p class="notice">Kontrollen gäller sökvägar, inte körbarhet, beroenden eller godkända tester. Kolumnen ”Verifiering av gränsen” beskriver dokumenterade provkrav. Filinnehåll och drift har inte granskats av generatorn. Länkar öppnar den lokala arbetskopian.</p>
<script>@@SCRIPT@@</script></body></html>"""


def main(argv: list[str] | None = None, *, root: Path | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(".cache/system-map/index.html"), help="Fristående HTML-fil (relativt repot).")
    args = parser.parse_args(argv)
    root = (root or Path(__file__).resolve().parent.parent).resolve()
    try:
        html, errors, warnings = render(root)
        output = (root / args.output).resolve()
        if output.suffix.lower() != ".html" or not output.is_relative_to(root / ".cache"):
            raise ValueError("Utdata måste vara en .html-fil under repots .cache/; produktfiler får inte skrivas över.")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(html, encoding="utf-8")
        print(f"Skapade {output} ({len(errors)} fel, {len(warnings)} varningar).")
        for issue in errors + warnings:
            print(issue, file=sys.stderr)
        return 1 if errors else 0
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"Systemkarta: {error} Ingen karta skrevs.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
