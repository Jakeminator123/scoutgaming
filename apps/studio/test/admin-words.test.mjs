import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Ordvakt för Admin: legacy-ord får inte stå i text som en administratör kan se.
// Rätt ord: miljö (inte sammansättning), spelbord (inte spelrum, Rumsnamn), Scoutgaming
// (inte Croupier); Astrid är raderad. Se apps/studio/docs/TERMINOLOGI.md.
const require = createRequire(import.meta.url);
const studio = fileURLToPath(new URL('..', import.meta.url));
const repo = join(studio, '..', '..');
export const LEGACY_WORDS = /sammansättning|spelrum|Rumsnamn|Astrid|Croupier/i;

// Filerna ändras i öppna PR:er #641 och #644 (scenmall → miljö; room-game-config även i #656–#658).
// Byt orden och ta bort raden när PR:en är mergad.
const PENDING = new Set([
  'apps/studio/client/admin/components/studio/resource-connections.tsx',
  'apps/studio/client/admin/components/studio/roulette-start-editor.tsx',
  'apps/studio/client/admin/components/studio/saved-scene-preview.tsx',
  'apps/studio/client/admin/components/studio/scene-publication.tsx',
  'apps/studio/client/admin/components/studio/studio-composition-panel.tsx',
  'apps/studio/client/admin/components/studio/studio-lifecycle-panel.tsx',
  'apps/studio/components/background-playback-editor.tsx',
  'apps/studio/components/composition-preview.tsx',
  'apps/studio/components/control-operator-directory.tsx',
  'apps/studio/components/control-resource-lifecycle.tsx',
  'apps/studio/components/dealer-forge-page.tsx',
  'apps/studio/components/lane-editor.tsx',
  'apps/studio/components/layer-asset-manager.tsx',
  'apps/studio/components/layer-selectors.tsx',
  'apps/studio/components/presentation-room-create.tsx',
  'apps/studio/components/room-game-config.tsx',
]);

function tsxFiles(dir, recursive) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return recursive && entry.name !== 'node_modules' ? tsxFiles(path, true) : [];
    return entry.isFile() && entry.name.endsWith('.tsx') ? [path] : [];
  });
}

// Attribut som bär kod, adresser eller stilar, aldrig text för en människa.
const CODE_ATTRIBUTES = /^(?:className|class|id|key|href|src|poster|type|name|role|htmlFor|value|defaultValue|method|action|target|rel|pattern|autoComplete|inputMode|accept|form|data-[\w-]+)$/;
// En sträng utan mellanslag som börjar med gemen eller bär tecken utöver bokstäver är kod:
// identifierare, sökvägar, URL:er, selektorer och CSS-klasser. Ett ensamt ord med versal är en etikett.
const CODE_LIKE = value => !/\s/.test(value) && (/^[^\p{Lu}]/u.test(value) || /[^\p{L}]/u.test(value));
// Kodnamn inne i en mening (croupier_auth.users, croupier-director, /admin/x) är inte ord.
const CODE_TOKEN = /\S*[\p{L}\d][_./][\p{L}\d]\S*|\b[\p{Ll}\d]+(?:-[\p{Ll}\d]+)+\b/gu;
export const legacyWord = text => LEGACY_WORDS.test(text.replace(CODE_TOKEN, ' '));

// swc ger globala span-positioner; en känd första rad gör dem relativa till filen.
const PREFIX = '0;\n';
const swc = require('next/dist/build/swc');
await swc.loadBindings();

// Synlig text i en TSX-fil: JSX-text och strängar, utan importer, kommentarer, typer och kodsträngar.
export async function visibleTexts(source, fileName = 'file.tsx') {
  const code = PREFIX + source;
  const module = await swc.parse(code, { filename: fileName, isModule: true, jsc: { parser: { syntax: 'typescript', tsx: true } } });
  const base = module.span.start;
  const texts = [];
  const add = (node, text, jsx = false) => {
    const value = text.replace(/\s+/g, ' ').trim();
    if (!value || !jsx && CODE_LIKE(value)) return;
    texts.push({ line: code.slice(0, node.span.start - base).split('\n').length - 1, text: value });
  };
  const visit = node => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== 'object') return;
    const type = node.type;
    if (['ImportDeclaration', 'ExportAllDeclaration', 'ExportNamedDeclaration'].includes(type) && node.source) return;
    if (typeof type === 'string' && type.startsWith('Ts')) { if (node.expression) visit(node.expression); return; }
    if (type === 'JSXAttribute' && CODE_ATTRIBUTES.test(node.name?.value ?? '')) return;
    if (type === 'KeyValueProperty') { visit(node.value); return; }
    if (type === 'MemberExpression') { visit(node.object); return; }
    if (type === 'JSXText') add(node, node.value, true);
    else if (type === 'StringLiteral') add(node, node.value);
    else if (type === 'TemplateLiteral') add(node, node.quasis.map(quasi => quasi.cooked ?? quasi.raw).join(' '));
    else if (type === 'TaggedTemplateExpression') return;
    for (const [key, value] of Object.entries(node)) if (key !== 'span' && key !== 'quasis') visit(value);
  };
  visit(module.body);
  return texts;
}

const files = [...tsxFiles(join(studio, 'client', 'admin'), true), ...tsxFiles(join(studio, 'components'), false)]
  .map(path => relative(repo, path).split('\\').join('/')).sort();

async function hits(paths) {
  const found = [];
  for (const path of paths) for (const { line, text } of await visibleTexts(readFileSync(join(repo, path), 'utf8'), path))
    if (legacyWord(text)) found.push(`${path}:${line}: ${text.slice(0, 120)}`);
  return found;
}

test('the word guard reads visible text and skips imports, comments, identifiers, URLs and CSS classes', async () => {
  const source = `import x from './spelrum-astrid';
// Croupier i en kommentar
export function A(){ const id='croupier-director'; const url='/admin/spelrum?dealer=astrid';
  return <div className="sammansattning spelrum-card" href="/rum" data-room="Spelrum">Spelrummet öppnas{' '}<b title="Rumsnamn">x</b>{\`Välj \${id} i Croupier\`}
    <p>{'Schemat croupier_auth.users läses, inte Croupier.'}</p><i>{'astrid'}{'Astrid'}</i></div>; }`;
  const texts = await visibleTexts(source);
  assert.deepEqual(texts.map(row => row.text), ['Spelrummet öppnas', 'Rumsnamn', 'x', 'Välj i Croupier', 'Schemat croupier_auth.users läses, inte Croupier.', 'Astrid']);
  assert.deepEqual(texts.map(row => row.line), [4, 4, 4, 4, 5, 5]);
  assert.deepEqual(texts.filter(row => legacyWord(row.text)).map(row => row.text), ['Spelrummet öppnas', 'Rumsnamn', 'Välj i Croupier', 'Schemat croupier_auth.users läses, inte Croupier.', 'Astrid']);
});

test('Admin shows no legacy words: sammansättning, spelrum, Rumsnamn, Astrid or Croupier', async () => {
  assert.ok(files.length > 50, 'the guard reads Admin and the shared components');
  for (const path of PENDING) assert.ok(files.includes(path), `${path} finns inte; ta bort raden ur PENDING`);
  const found = await hits(files.filter(path => !PENDING.has(path)));
  assert.deepEqual(found, [], 'byt till miljö, spelbord, spelbordets namn eller Scoutgaming:\n' + found.join('\n'));
});
