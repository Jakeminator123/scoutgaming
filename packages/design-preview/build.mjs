import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind3 from 'tailwindcss3';
import tailwind4 from '@tailwindcss/postcss';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, '../../lab/design-preview-build');
for (const surface of ['admin', 'lobby']) {
  const check = spawnSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', surface],
    { cwd: root, stdio: 'inherit', windowsHide: true });
  if (check.error || check.status !== 0) throw new Error(`Typecheck failed for ${surface}.`);
}
await mkdir(output, { recursive: true });
const commonCss = await readFile(resolve(root, 'runtime/preview.css'), 'utf8');
for (const surface of ['admin', 'lobby']) {
  const source = resolve(root, surface), outdir = resolve(output, surface);
  await mkdir(outdir, { recursive: true });
  await build({ entryPoints: [resolve(source, 'entry.tsx')], outfile: resolve(outdir, 'app.js'),
    bundle: true, minify: true, sourcemap: false, platform: 'browser', target: 'es2022', jsx: 'automatic',
    // The shared room validator reaches this lazy game-only browser import.
    // It is served by the game runtime and is never used by the design lobby.
    external: ['/composition-runtime/compositor.js'],
    define: { 'process.env.NODE_ENV': '"production"' },
    alias: { '@': source, 'next/link': resolve(root, 'runtime/navigation.tsx'),
      'next/navigation': resolve(root, 'runtime/navigation.tsx'), 'next/image': resolve(root, 'runtime/image.ts') },
  });
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
    plugins = [tailwind3({ ...config, content: [source.replaceAll('\\', '/') + '/**/*.{ts,tsx}'] })];
    css += '\n' + await readFile(resolve(source, 'app/studio.css'), 'utf8');
  } else {
    css = css.replace("@import 'tailwindcss';", "@import 'tailwindcss' source(none);\n@source '../components';\n@source '../app';\n@source '../entry.tsx';");
    plugins = [tailwind4({ base: source })];
  }
  const result = await postcss(plugins).process(css, { from: resolve(source, 'app/globals.css') });
  await writeFile(resolve(outdir, 'theme.css'), result.css + '\n' + commonCss);
  await cp(resolve(source, 'public'), resolve(outdir), { recursive: true });
  const title = surface === 'admin' ? 'Administration' : 'Spellobby';
  const extra = surface === 'admin' ? '<link rel="stylesheet" href="/admin/_assets/admin/app.css">' : '';
  await writeFile(resolve(outdir, 'index.html'), `<!doctype html><html lang="sv" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title} · Arbetsversion · Scoutgaming</title>${extra}<link rel="stylesheet" href="/admin/_assets/${surface}/theme.css"></head><body class="preview-${surface} font-sans antialiased"><div id="root"></div><script src="/admin/_assets/${surface}/app.js" defer></script></body></html>`);
}
await mkdir(resolve(output, 'fonts'), { recursive: true });
for (const [name, original] of Object.entries({ inter: 'inter-latin-wght-normal', space: 'space-grotesk-latin-wght-normal', mono: 'jetbrains-mono-latin-wght-normal' })) {
  await cp(resolve(root, '../../lab/app/fonts', original + '.woff2'), resolve(output, 'fonts', name + '.woff2'));
}
console.log('Design workspaces built: /admin and /admin/lobby (registered catalogue, no writes).');
