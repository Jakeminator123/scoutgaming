import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../build.mjs';
import { checkIsolatedOrigin } from './prepare.mjs';

export async function buildPreview({ origin = process.env.CROUPIER_GAME_ORIGIN,
  output = new URL('./dist/', import.meta.url),
  configUrl = new URL('./vercel.json', import.meta.url) } = {}) {
  const config = JSON.parse(await readFile(configUrl, 'utf8'));
  checkIsolatedOrigin(origin);
  if (!Array.isArray(config.rewrites) || !config.rewrites.length
    || config.rewrites.some(route => new URL(route.destination).origin !== origin)) {
    throw Error('Preview-proxyn måste peka enbart på CROUPIER_GAME_ORIGIN.');
  }
  await build({ origin, frontendPreview: true, output });
  const game = new URL('frontend-preview/game/index.html', output);
  const html = await readFile(game, 'utf8');
  const marker = '</head>';
  if (!html.includes(marker)) throw Error('Förhandsfilen saknar HTML-head.');
  await writeFile(game, html.replace(marker, '<link rel="stylesheet" href="/frontend-preview/preview-only.css">\n' + marker));
  await copyFile(new URL('./preview-only.css', import.meta.url), new URL('frontend-preview/preview-only.css', output));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await buildPreview(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
