import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind3 from 'tailwindcss3';
import tailwind4 from '@tailwindcss/postcss';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { surfaceBundleOptions } from './surface-bundle.mjs';

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
  let css = await readFile(resolve(source, 'app/globals.css'), 'utf8');
  let plugins;
  if (surface === 'admin') {
    // The original Tailwind config uses require; load it as CJS for unchanged plugin semantics.
    const cjs = await build({ entryPoints: [resolve(source, 'tailwind.config.ts')], bundle: true,
      platform: 'node', format: 'cjs', write: false, packages: 'external' });
    const cjsFile = resolve(root, '.cache/tailwind-admin.cjs');
    await mkdir(dirname(cjsFile), { recursive: true });
    await writeFile(cjsFile, cjs.outputFiles[0].text);
    const imported = await import(pathToFileURL(cjsFile).href);
    const config = imported.default.default;
    plugins = [tailwind3({ ...config, content: [source.replaceAll('\\', '/') + '/**/*.{ts,tsx}', resolve(root,'../components').replaceAll('\\','/')+'/**/*.{ts,tsx,mjs}'] })];
    css += '\n' + await readFile(resolve(source, 'app/studio.css'), 'utf8');
  } else {
    css = css.replace("@import 'tailwindcss';", "@import 'tailwindcss' source(none);\n@source '../components';\n@source '../app';\n@source '../entry.tsx';");
    plugins = [tailwind4({ base: source })];
  }
  const result = await postcss(plugins).process(css, { from: resolve(source, 'app/globals.css') });
  await writeFile(resolve(outdir, 'theme.css'), result.css + '\n' + (publicLobby
    ? commonCss.replaceAll('/admin/_assets/fonts/', '/lobby/_assets/fonts/') : commonCss));
  // Admin has no static files of its own; the lobby ships its portraits and hero media and must have them.
  if (surface !== 'admin' || existsSync(resolve(source, 'public'))) await cp(resolve(source, 'public'), resolve(outdir), { recursive: true });
  const title = surface === 'admin' ? 'Scoutgaming Admin' : 'Spellobby · Arbetsversion · Scoutgaming';
  const extra = surface === 'admin' ? '<link rel="stylesheet" href="/admin/_assets/admin/app.css">' : '';
  await writeFile(resolve(outdir, 'index.html'), `<!doctype html><html lang="sv" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title>${extra}<link rel="stylesheet" href="${assetBase}/_assets/${assetSurface}/theme.css"></head><body class="preview-${assetSurface} font-sans antialiased"><div id="root"></div><script src="${assetBase}/_assets/${assetSurface}/app.js" defer></script><script src="${process.env.CROUPIER_LAB_BASE_PATH === '/studio' ? '/studio' : ''}/assistant-widget.js" defer></script></body></html>`);
}
await build({entryPoints:[resolve(root,'admin/lib/dealer-chat-import.mjs')],outfile:resolve(output,'admin/chat-import.js'),bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',
  define:{'process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"1"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':JSON.stringify(process.env.CROUPIER_LAB_BASE_PATH==='/studio'?'/studio':'')}});
await mkdir(resolve(output, 'fonts'), { recursive: true });
for (const [name, original] of Object.entries({ inter: 'inter-latin-wght-normal', space: 'space-grotesk-latin-wght-normal', mono: 'jetbrains-mono-latin-wght-normal' })) {
  await cp(resolve(root, '../app/fonts', original + '.woff2'), resolve(output, 'fonts', name + '.woff2'));
}
console.log('Workspaces built: /admin (Studio drafts and explicit dealer import), /admin/lobby and /lobby (registered catalogues).');
