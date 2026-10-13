#!/usr/bin/env python3
"""Render public/docs/partner-api.md → partner-api.html with per-section Copy-for-LLM / View-as-Markdown."""
import re, html, json
from pathlib import Path
here = Path(__file__).resolve().parent / 'public/docs'
md = (here / 'partner-api.md').read_text(encoding='utf-8')
def inline(t):
    t = html.escape(t); t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t); t = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', t); t = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<i>\1</i>', t); return t
sections = []
for i, part in enumerate(re.split(r'\n(?=## )', md)):
    out = []; inpre = intable = inul = False
    for line in part.split('\n'):
        if line.startswith('```'):
            if inul: out.append('</ul>'); inul = False
            if inpre: out.append('</code></pre></div>'); inpre = False
            else: out.append('<div class="codewrap"><button class="copybtn" data-copy-code>Copy</button><pre><code>'); inpre = True
            continue
        if inpre: out.append(html.escape(line)); continue
        if line.startswith('|'):
            cells = [c.strip().replace(r'\|', '|') for c in re.split(r'(?<!\\)\|', line.strip('|'))]
            if all(re.fullmatch(r'-+', c) for c in cells): continue
            tag = 'td' if intable else 'th'
            if not intable: out.append('<table>'); intable = True
            out.append('<tr>' + ''.join(f'<{tag}>{inline(c)}</{tag}>' for c in cells) + '</tr>'); continue
        if intable: out.append('</table>'); intable = False
        if line.startswith('- '):
            if not inul: out.append('<ul>'); inul = True
            out.append('<li>' + inline(line[2:]) + '</li>'); continue
        if inul and not line.strip(): out.append('</ul>'); inul = False
        if line.startswith('# '): out.append(f'<h1>{html.escape(line[2:])}</h1>'); continue
        if line.startswith('## '): out.append(f'<h2>{html.escape(line[3:])}<span class="tools"><button data-copy-section="{i}">Copy for LLM</button><button data-view-md="{i}">View as Markdown</button></span></h2>'); continue
        if line.startswith('### '): out.append(f'<h3>{html.escape(line[4:])}</h3>'); continue
        if not line.strip(): continue
        out.append(f'<p>{inline(line)}</p>')
    if inul: out.append('</ul>')
    if intable: out.append('</table>')
    sections.append({'html': '\n'.join(out), 'md': part})
body = ''.join(f'<section data-section="{i}">{s["html"]}<div class="mdview" data-mdview="{i}" hidden><pre><code>{html.escape(s["md"])}</code></pre></div></section>' for i, s in enumerate(sections))
mdjson = json.dumps([s['md'] for s in sections]).replace('</', '<\\/')
css = ":root{--bg:#0d0f12;--paper:#f2f1ed;--mut:#9a9d93;--lime:#d6ff3a;--line:#2a2e33;--panel:#15181c}body{margin:0;background:var(--bg);color:var(--paper);font:14px/1.6 Inter,-apple-system,Arial,sans-serif}main{max-width:920px;margin:0 auto;padding:40px 20px}h1{font-size:26px;margin:0 0 6px}h2{font-size:17px;margin:38px 0 10px;color:var(--lime);letter-spacing:.04em;display:flex;align-items:center;gap:12px;flex-wrap:wrap}h3{font-size:14px;margin:22px 0 6px}code{font:12px ui-monospace,Menlo,monospace;background:var(--panel);padding:1px 5px;border-radius:4px}pre{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;overflow:auto;margin:0}pre code{background:none;padding:0;white-space:pre}.codewrap{position:relative;margin:10px 0}.copybtn{position:absolute;top:8px;right:8px}table{border-collapse:collapse;width:100%;margin:10px 0;font-size:12.5px}th,td{border:1px solid var(--line);padding:6px 9px;text-align:left;vertical-align:top}th{color:var(--mut);font-weight:600;font-size:11px;letter-spacing:.08em}a{color:var(--lime)}p{margin:8px 0}ul{padding-left:20px}.brand{font-size:10px;letter-spacing:.14em;color:var(--mut);margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}button{background:transparent;color:var(--mut);border:1px solid var(--line);border-radius:6px;padding:3px 9px;font:10px/1.6 ui-monospace,Menlo,monospace;letter-spacing:.06em;cursor:pointer}button:hover{color:var(--paper);border-color:var(--paper)}button.ok{color:#111;background:var(--lime);border-color:var(--lime)}.tools{display:inline-flex;gap:6px;margin-left:auto}.mdview{margin:10px 0}"
js = """const flash=(b,t='Copied')=>{const o=b.textContent;b.textContent=t;b.classList.add('ok');setTimeout(()=>{b.textContent=o;b.classList.remove('ok');},1400);};
const copy=async(b,text)=>{try{await navigator.clipboard.writeText(text);flash(b);}catch{const ta=document.createElement('textarea');ta.value=text;document.body.append(ta);ta.select();document.execCommand('copy');ta.remove();flash(b);}};
document.querySelectorAll('[data-copy-all]').forEach(b=>b.onclick=()=>copy(b,MD.join('\\n\\n')));
document.querySelectorAll('[data-copy-section]').forEach(b=>b.onclick=()=>copy(b,MD[+b.dataset.copySection]));
document.querySelectorAll('[data-copy-code]').forEach(b=>b.onclick=()=>copy(b,b.nextElementSibling.textContent));
document.querySelectorAll('[data-view-md]').forEach(b=>b.onclick=()=>{const v=document.querySelector(`[data-mdview="${b.dataset.viewMd}"]`);v.hidden=!v.hidden;b.textContent=v.hidden?'View as Markdown':'Hide Markdown';});"""
page = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Croupier Partner API v1</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style></head><body><main>'
    '<div class="brand"><span>SCOUT GAMING GROUP &middot; LIVE CASINO &middot; PARTNER DOCUMENTATION</span><span class="tools"><button data-copy-all>Copy whole page for LLM</button><a href="/docs/partner-api.md" download style="font-size:10px">Download .md</a></span></div>'
    + body + '</main><script>const MD=' + mdjson + ';\n' + js + '</script></body></html>')
(here / 'partner-api.html').write_text(page, encoding='utf-8', newline='\n'); print('html rebuilt:', len(sections), 'sections,', len(page), 'bytes')
