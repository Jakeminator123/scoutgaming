// Reproducible one-time source transfer. Never executed by the application.
// Usage: node port-source.mjs <Croupier-Kevin checkout>
// Rerunning overwrites original-views.jsx and would restore the factory Team view.
// Membership now renders from views/team.jsx; reapply `team: TeamViewRoute` after any rerun.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const here = fileURLToPath(new URL('.', import.meta.url));
const req = createRequire(new URL('../../package.json', import.meta.url));
const parser = req('next/dist/compiled/babel/parser');
const generate = req('next/dist/compiled/babel/generator').default;
const traverse = req('next/dist/compiled/babel/traverse').default;
const types = req('next/dist/compiled/babel/types');
const postcss = req('postcss');
const sourceRoot = resolve(process.argv[2] || '');
const expected = '7dee0901c75b7470c16a178079d5a5ebe4f11b9f';
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim() !== expected) throw Error('Source commit mismatch');
const source = join(sourceRoot, 'tools/bo-design/final');
const parts = ['shell.jsx', 'design.jsx', 'v-live.jsx', 'v-player.jsx', 'v-money.jsx', 'v-reports.jsx', 'v-settings.jsx', 'v-studio.jsx', 'theme.jsx', 'v-dealers.jsx', 'v-games.jsx', 'ops-layouts.jsx', 'ops.jsx'];
const replacements = {
  Sidebar: '',
  tmSave: "async function tmSave() { throw new Error('Access configuration is not connected in this preview.'); }",
  thFont: "function thFont() { /* Local system fonts only; no Google Fonts requests. */ }",
  thReadBook: `async function thReadBook(file) {
    if (!/^image\\/(png|jpeg|webp)$/.test(file.type)) throw Error('Use PNG, JPG or WebP. PDF import is not connected.');
    if (file.size > 2100000) throw Error('Use an image under 2 MB.');
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const c = document.createElement('canvas'), k = 240 / img.width;
      c.width = 240; c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return { canvases: [c], pages: 1 };
    } finally { URL.revokeObjectURL(url); }
  }`,
  dlSay: "function dlSay() { return false; /* Provider/browser speech is deliberately disconnected. */ }",
  useJson: "function useJson(path) { return runtime.catalogs[path] || {error:true}; }",
  RecordedActionTree: `function RecordedActionTree() { return <section className="panel"><div className="panel-h"><h2>Presentationshändelser och kopplingar</h2></div><div className="note">Spelhändelse → presentationsprofil → uppspelningsplan → spelklient. Kopplingen är inte ansluten i förhandsvisningen. Använd den befintliga Studio-ytan för redigering.</div><div className="panel-h"><a className="btn" href={runtime.studioUrl('/tree')}>Öppna presentationshändelser</a></div></section>; }`,
  stExportUrl: 'const stExportUrl = () => null;',
};
const manifest = { sourceCommit: expected, sourceDirectory: 'tools/bo-design/final', transferred: [], omitted: { 'bootstrap.jsx': 'Replaced by instance-local runtime; no legacy API loader.', 'mount.jsx': 'Replaced by native client component; no second React root.', 'astrid.jsx': 'Legacy simulator/video player not imported; GitHub remains gameplay authority.', 'test.jsx': 'Replaced by source ThFrame/TableSVG visual state preview; no imitation wallet or player session.', 'loader.mjs': 'Replaced by authenticated fixture snapshot API.', 'export.mjs': 'CSV preview only; PDF/XLSX provider dependencies not imported.' } };
const blocks = [];
for (const file of parts) {
  const original = await readFile(join(source, file), 'utf8');
  manifest.transferred.push({ file, sha256: createHash('sha256').update(original).digest('hex') });
  const ast = parser.parse(original, {sourceType:'module',plugins:['jsx']});
  let text = ast.program.body.map(node => {
    const name = node.id?.name || node.declarations?.[0]?.id?.name;
    if (Object.hasOwn(replacements, name)) return replacements[name];
    const raw = original.slice(node.start,node.end);
    if (/^Object\.assign\(window/.test(raw) || /^window\.getTableDesign\s*=/.test(raw)) return '';
    return raw;
  }).join('\n');
  text = text.replaceAll('window.BO_DATA2', 'runtime.data2').replaceAll('window.BO_DATA', 'runtime.data')
    .replaceAll('window.BO_RAW', 'runtime.raw').replaceAll('window.BO_DESIGN_STORE', 'runtime.designStore')
    .replaceAll('window.BO_REFRESH', 'runtime.refresh').replaceAll('localStorage', 'runtime.memory')
    .replaceAll('location.reload()', 'runtime.refresh()')
    .replaceAll('Table state and balances are connected.', 'Fixture data only; table state and balances are not connected.')
    .replaceAll('Live · ', 'Fixture · ')
    .replaceAll('Publishing saves a shared preview profile for design review.', 'Apply stores this draft in this tab only. It is not published to any game.')
    .replaceAll('Theme published · applies at the next round for ', 'Local preview updated for ')
    .replaceAll('Preview profile published for ', 'Local preview updated for ')
    .replaceAll('Publish brand theme', 'Apply local brand preview')
    .replaceAll('Publish table', 'Apply local table preview')
    .replaceAll('>Publish<', '>Apply locally<')
    .replaceAll('>Publish changes<', '>Apply locally<')
    .replaceAll('>Published<', '>Local preview<')
    .replaceAll('>Unpublished changes<', '>Local changes<')
    .replaceAll('Players using this brand receive the published chips, cards and controls at the next betting round. A hand already in progress keeps its current design.', 'This applies the design to this local preview only. No players, games or shared profiles are changed.')
    .replaceAll('You can still publish.', 'You can still apply this local preview.')
    .replaceAll('saved for shared previews', 'kept in this tab only')
    .replaceAll('Draft saved', 'Local draft saved')
    .replaceAll('shared drafts', 'local drafts')
    .replaceAll('shared with your team', 'stored in this tab only')
    .replaceAll('Game audit requires admin.', 'Only this fictional operator is shown.')
    .replaceAll('runtime activation', 'game activation')
    .replaceAll("href={(session.gameUrl||'https://croupier.scoutgg.dev/')+'?brand='+brand}", 'href="#test"')
    .replaceAll('Open branded game', 'Open local preview')
    .replaceAll('href="#test" target="_blank" rel="noopener">Open local preview', 'href="#test">Open local preview')
    .replaceAll('PDF, PNG or JPG', 'PNG, JPG or WebP · PDF not connected')
    .replaceAll('accept=".pdf,image/*"', 'accept="image/png,image/jpeg,image/webp"')
    .replaceAll('Could not read the file. Try a PDF or a PNG/JPG of a brand book page.', 'Could not read the file. Use a PNG, JPG or WebP under 2 MB. PDF import is not connected.')
    .replaceAll('Every Higgsfield video generated for the dealers, with its prompt.', 'Granskning av genererat innehåll. Inga produktionsjobb eller media är anslutna i förhandsvisningen.')
    .replaceAll('Jakob’s events, the game engine, Emil’s clips and recorded rounds in one connected workspace.', 'Intern arbetsyta för presentationshändelser och kopplingar. Förhandsvisningen har ingen spelanslutning.')
    .replaceAll('href="/docs/partner-api.html"', 'href="#api"');
  text=text.replaceAll('.toLocaleTimeString()', ".toLocaleTimeString('sv-SE',{timeZone:'Europe/Stockholm'})")
    .replaceAll('.toLocaleString()', ".toLocaleString('sv-SE',{timeZone:'Europe/Stockholm'})")
    .replaceAll(".toLocaleTimeString('sv-SE')", ".toLocaleTimeString('sv-SE',{timeZone:'Europe/Stockholm'})")
    .replaceAll(".toLocaleString('sv-SE')", ".toLocaleString('sv-SE',{timeZone:'Europe/Stockholm'})");
  if (file === 'shell.jsx') {
    text = text.replace(/const NAV = \[[\s\S]*?\];/, 'const NAV = runtime.navigation;');
    text = text.replace(/const STUDIO = \[[\s\S]*?\];/, 'const STUDIO = runtime.studioNavigation;');
    text = text.replace(/const BO_ROLES = \[[^;]+;/, "const BO_ROLES = runtime.surface === 'partner' ? [['reader','Partner analyst'],['staff','Partner editor'],['admin','Partner administrator']] : [['reader','Internal reader'],['staff','Internal staff'],['admin','Administrator'],['superadmin','Internal administrator']];");
  }
  if (file === 'v-live.jsx') text = text.replace('{src && <div className="src">From <code>{src}</code></div>}', '');
  if (file === 'theme.jsx') {
    text = text.replace("const commit = n => { setAll(n); clearTimeout(saveT.current); saveT.current = setTimeout(() => { try { runtime.designStore.write('themes',n); } catch (e) { toast('Could not save. The logo may be too large.'); } }, 300); };", "const commit = n => { setAll(n); runtime.designStore.write('themes',n); };");
  }
  if (file === 'v-dealers.jsx') {
    text = text.replace('function DealersHub({ toast }) {', "function DealersHub({ toast }) {\n  if (runtime.surface === 'partner') return <PartnerDealerSelection toast={toast} />;");
  }
  if (file === 'v-games.jsx') {
    text = text.replace("const all = [...GM_ROOMS.map", "const all = [...GM_ROOMS.filter(([n]) => runtime.surface === 'internal' || n === 'Dark Hall').map");
    text = text.replace('<label className="vcard gm-up">', "{runtime.surface === 'internal' && <label className=\"vcard gm-up\">")
      .replace('before it can go live.</span></label>', 'before it can go live.</span></label>}');
    text = text.replace('Create or edit dealers →', 'View available dealers →');
  }
  if (file === 'v-settings.jsx') {
    text = text.replace('function Team({ toast, role: myRole = \'superadmin\' }) {', "function Team({ toast, role: myRole = 'superadmin' }) {\n  return <ScopedTeamPreview />;\n} function LegacyTeamReference({ toast, role: myRole = 'superadmin' }) {").replace('\u001f','\n');
  }
  if(file==='v-reports.jsx'){
    text=text.replace('<button key={f} className={fmt', '<button key={f} disabled={f!==\'CSV\'} title={f===\'CSV\'?\'Labelled fixture CSV\':\'Export format not connected\'} className={fmt')
      .replace('<button className="btn" onClick={() => setSched(true)}>Schedule</button>', '<button className="btn" disabled title="Email delivery is not connected">Schedule</button>')
      .replace('Schedule settings can be prepared for email delivery.', 'Only labelled fixture CSV is available. Email delivery is not connected.');
  }
  if (file === 'v-live.jsx') text = text.replace('function PitBosses({ toast', 'function PitBosses({ toast');
  // Every imported image is resolved through the finite bundled-asset map. Unknown
  // legacy media URLs cannot initiate requests to the removed BO server.
  const modified = parser.parse(text,{sourceType:'module',plugins:['jsx']});
  traverse(modified,{JSXAttribute(path) {
    const node=path.node;
    if(node.name.name!=='src'||!node.value)return;
    const expression=node.value.type==='JSXExpressionContainer'?node.value.expression:types.stringLiteral(node.value.value);
    node.value=types.jsxExpressionContainer(types.callExpression(types.identifier('assetUrl'),[expression]));
  }});
  text = generate(modified,{comments:true}).code;
  blocks.push(`\n// Source: ${file} at ${expected.slice(0,8)}; see source-provenance.json.\n${text}`);
}
const preamble = await readFile(join(here, 'factory-preamble.txt'), 'utf8');
const appendix = await readFile(join(here, 'factory-appendix.txt'), 'utf8');
await writeFile(join(here, 'original-views.jsx'), `// Native React port of the GitLab design source. Instance-local, no legacy server.\nimport React from 'react';\nexport function createOriginalViews(runtime) {\n${preamble}\n${blocks.join('\n')}\n${appendix}\n}\n`);
const styles = ['bo.css','test.css','astrid.css','views.css','theme.css','shell.css','connected.css'];
const css = postcss.parse((await Promise.all(styles.map(f => readFile(join(source, f), 'utf8')))).join('\n'));
css.walkRules(rule => {
  if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
  rule.selector = postcss.list.comma(rule.selector).map(selector => {
    if ([':root','html','body'].includes(selector.trim())) return '.kevin-bo';
    return '.kevin-bo ' + selector;
  }).join(',');
});
await writeFile(join(here, 'original.css'), '/* Scoped source CSS; never changes global Studio styles. */\n'+css.toString());
await mkdir(join(here, 'assets'), { recursive: true });
const images = ['amira-portrait.jpg','astrid-portrait.jpg','astrid-stream.png','azure-room.jpg','darkhall-room.jpg','goldensalon-room.jpg','mei-portrait.jpg','prive-room.jpg','scout-mark.png','vera-portrait.jpg'];
const imports = [], entries = [];
for (const [i, name] of images.entries()) {
  await copyFile(join(sourceRoot,'web/public/bo/img',name),join(here,'assets',name));
  imports.push(`import asset${i} from './assets/${name}';`); entries.push(`'/bo/img/${name}':asset${i}.src`);
}
await copyFile(join(sourceRoot,'web/public/bo/design-studio/astrid/startbild.png'),join(here,'assets/astrid-start.png'));
imports.push("import start from './assets/astrid-start.png';"); entries.push("'/bo/design-studio/astrid/startbild.png':start.src");
await writeFile(join(here,'assets.mjs'), `${imports.join('\n')}\nconst assets={${entries.join(',')}};\nexport function assetUrl(value) { if (typeof value !== 'string') return undefined; if (/^data:image\\/(png|jpeg|webp);base64,/.test(value)) return value; return assets[value]; }\n`);
await writeFile(join(here, 'source-provenance.json'), JSON.stringify(manifest,null,2)+'\n');
console.log('Transferred source JSX, scoped CSS and 11 reference images.');
