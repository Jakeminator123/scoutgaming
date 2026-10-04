import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Offline documentation generator. The existing environment registry stays
// authoritative; only names and source references enter the HTML document.
const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const read = name => JSON.parse(readFileSync(resolve(directory, name), 'utf8').replace(/^\uFEFF/, ''));
const data = { catalog: read('catalog.json'), routes: read('routes.json'), storage: read('storage.json'), flows: read('flows.json') };
const registry = JSON.parse(readFileSync(resolve(root, 'docs/environment-variables.json'), 'utf8'));
data.environment = { source: 'docs/environment-variables.json', services: registry.services };
for (const part of ['routes', 'storage', 'flows']) {
  if (data[part].sourceSha !== data.catalog.sourceSha) throw Error('Inventory version mismatch: ' + part);
}
const sourcePaths = new Set();
function visit(value) {
  if (typeof value === 'string' && /^(?:apps|web|lab|ops|tools|test|services|open-claw|presentation-runtime|pipeline|docs|planes|\.github)\/[\w./@+\[\]-]+(?::\d+)?$/.test(value)) sourcePaths.add(value.replace(/:\d+$/, ''));
  else if (Array.isArray(value)) value.forEach(visit);
  else if (value && typeof value === 'object') Object.values(value).forEach(visit);
}
visit(data);
for (const source of sourcePaths) {
  const resolved = resolve(root, source);
  if (relative(root, resolved).startsWith('..') || !existsSync(resolved)) throw Error('Missing inventory source: ' + source);
}
const target = resolve(directory, 'index.html');
const html = readFileSync(target, 'utf8');
const marker = /(<script id="system-data" type="application\/json">)[\s\S]*?(<\/script>)/;
if (!marker.test(html)) throw Error('Documentation data marker missing');
const encoded = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
writeFileSync(target, html.replace(marker, (_, start, end) => start + encoded + end));
console.log(JSON.stringify({ output: 'docs/system-map/index.html', sourceSha: data.catalog.sourceSha, verifiedSourcePaths: sourcePaths.size, providerCalls: 0 }));
