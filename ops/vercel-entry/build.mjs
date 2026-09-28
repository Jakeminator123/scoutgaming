import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function blackjackUrl(value, { local = false } = {}) {
  let url;
  try { url = new URL(value); } catch { throw Error('Ange CROUPIER_GAME_ORIGIN som spelserverns exakta HTTPS-origin.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.origin !== value || url.username || url.password || url.search || url.hash || url.pathname !== '/'
    || (local ? !(loopback && url.protocol === 'http:') : url.protocol !== 'https:' || loopback)) {
    throw Error('CROUPIER_GAME_ORIGIN måste vara en exakt HTTPS-origin; --local tillåter endast lokal HTTP.');
  }
  return `${url.origin}/blackjack`;
}
export async function build({ origin = process.env.CROUPIER_GAME_ORIGIN, local = false, output = new URL('./dist/', import.meta.url) } = {}) {
  const href = blackjackUrl(origin, { local });
  const source = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  await mkdir(output, { recursive: true });
  await writeFile(new URL('index.html', output), source.replace('{{BLACKJACK_URL}}', href));
  await copyFile(new URL('../../web/public/blackjack-entry.css', import.meta.url), new URL('style.css', output));
  console.log('Statisk ingång byggd. Ingen deployment utförd.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--local')) throw Error('Använd node build.mjs [--local].');
    await build({ local: args.includes('--local') });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
