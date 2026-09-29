import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blackjackUrl } from '../build.mjs';

const productionOrigin = 'https://croupier-v2.onrender.com';
const marker = '__ISOLATED_BACKEND_ORIGIN__';

export function checkIsolatedOrigin(origin) {
  blackjackUrl(origin);
  if (origin === productionOrigin || new URL(origin).hostname.endsWith('.vercel.app')) {
    throw Error('Preview får inte använda Production-backend eller Vercel som backend.');
  }
  return origin;
}

export async function prepareConfig({ origin, confirmedIsolated = false,
  output = new URL('./vercel.json', import.meta.url) } = {}) {
  checkIsolatedOrigin(origin);
  if (!confirmedIsolated) throw Error('Bekräfta att backend har egen testdatabas och annat hostname.');
  const template = await readFile(new URL('./vercel.template.json', import.meta.url), 'utf8');
  if (!template.includes(marker) || template.includes(productionOrigin)) throw Error('Osäker Preview-mall.');
  const config = JSON.parse(template.replaceAll(marker, origin));
  if (!Array.isArray(config.rewrites) || !config.rewrites.length
    || config.rewrites.some(route => new URL(route.destination).origin !== origin)) {
    throw Error('Preview-proxyn måste peka enbart på isolerad backend.');
  }
  await writeFile(output, JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
  return config;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--isolated-backend') {
      throw Error('Använd node prepare.mjs --isolated-backend https://EXAKT-TESTORIGIN');
    }
    await prepareConfig({ origin: process.argv[3], confirmedIsolated: true });
    console.log('Ignorerad Preview-vercel.json skapad; ingen deployment utförd.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
