import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { surfaceBundleOptions } from './surface-bundle.mjs';
import { themeModeBootstrap } from '../lib/theme-mode.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, '../design-preview-build');
for (const surface of ['admin', 'lobby']) {
  const check = spawnSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', surface],
    { cwd: root, stdio: 'inherit', windowsHide: true });
  if (check.error || check.status !== 0) throw new Error(`Typecheck failed for ${surface}.`);
}
await mkdir(output, { recursive: true });
const commonCss = await readFile(resolve(root, 'runtime/preview.css'), 'utf8');
for (const surface of ['admin', 'lobby', 'public-lobby']) {
  const publicLobby = surface === 'public-lobby';
  const source = resolve(root, publicLobby ? 'lobby' : surface), outdir = resolve(output, surface);
  const assetBase = publicLobby ? '/lobby' : '/admin';
  const assetSurface = publicLobby ? 'lobby' : surface;
  await mkdir(outdir, { recursive: true });
  await build({ ...surfaceBundleOptions(surface), outfile: resolve(outdir, 'app.js') });
  // Samma Tailwind 4-väg för båda ytorna. Admins globals.css anger sina egna källor; lobbyns
  // begränsas här till sina mappar.
  let css = await readFile(resolve(source, 'app/globals.css'), 'utf8');
  if (surface !== 'admin') css = css.replace("@import 'tailwindcss';", "@import 'tailwindcss' source(none);\n@source '../components';\n@source '../app';\n@source '../entry.tsx';");
  const result = await postcss([tailwind({ base: source })]).process(css, { from: resolve(source, 'app/globals.css') });
  await writeFile(resolve(outdir, 'theme.css'), result.css + '\n' + (publicLobby
    ? commonCss.replaceAll('/admin/_assets/fonts/', '/lobby/_assets/fonts/') : commonCss));
  // Admin has no static files of its own; the lobby ships its portraits and hero media and must have them.
  if (surface !== 'admin' || existsSync(resolve(source, 'public'))) await cp(resolve(source, 'public'), resolve(outdir), { recursive: true });
  const title = surface === 'admin' ? 'Scoutgaming Admin' : 'Spellobby · Arbetsversion · Scoutgaming';
  const extra = surface === 'admin' ? '<link rel="stylesheet" href="/admin/_assets/admin/app.css">' : '';
  await writeFile(resolve(outdir, 'index.html'), `<!doctype html><html lang="sv" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title>${extra}<link rel="stylesheet" href="${assetBase}/_assets/${assetSurface}/theme.css"></head><body class="preview-${assetSurface} font-sans antialiased"><div id="root"></div><script src="${assetBase}/_assets/${assetSurface}/app.js" defer></script><script src="/studio/assistant-widget.js" defer></script></body></html>`);
}
await build({entryPoints:[resolve(root,'admin/lib/dealer-chat-import.mjs')],outfile:resolve(output,'admin/chat-import.js'),bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',
  define:{'process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"1"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'"/studio"'}});
// Lägesvalet (lib/theme-mode.mjs) körs före Admins stilmall. CSP:n tillåter inga inline-skript,
// så startskriptet är en egen fil som Admin-dokumentet laddar direkt efter teckenkodningen.
await writeFile(resolve(output, 'admin/theme-mode.js'), themeModeBootstrap + '\n');
const adminDocument = resolve(output, 'admin/index.html'), modeScript = '<script src="/admin/_assets/admin/theme-mode.js"></script>';
const adminHtml = (await readFile(adminDocument, 'utf8')).replace('<meta charset="utf-8">', '$&' + modeScript);
if (!adminHtml.includes(modeScript)) throw new Error('The Admin document has no <meta charset="utf-8"> to place the mode script after.');
await writeFile(adminDocument, adminHtml);
await mkdir(resolve(output, 'fonts'), { recursive: true });
for (const [name, original] of Object.entries({ inter: 'inter-latin-wght-normal', space: 'space-grotesk-latin-wght-normal', mono: 'jetbrains-mono-latin-wght-normal' })) {
  await cp(resolve(root, '../app/fonts', original + '.woff2'), resolve(output, 'fonts', name + '.woff2'));
}
console.log('Workspaces built: /admin (Studio drafts and explicit dealer import), /admin/lobby and /lobby (registered catalogues).');
