#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function openBrowser(url) {
  const [command, args] = process.platform === 'win32'
    ? ['powershell.exe', ['-NoProfile', '-Command', `Start-Process '${url}'`]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  const child = spawn(command, args, { windowsHide: true, stdio: 'ignore' });
  child.on('error', () => console.log(`Öppna ${url} i webbläsaren.`));
}
export const publishedProductUrl = 'https://www.scoutgaming.tech/lobby';
// The product has one path (Vercel + Render + Neon + Blob). Local server pairs,
// their SQLite fixture and connected-local modes are retired; saved local data stays untouched.
const retiredFlags = ['--offline', '--skip-build', '--check', '--astrid-camera', '--cloud-storage'];
export async function main(args = process.argv.slice(2), { open = openBrowser, log = console.log } = {}) {
  if (args.some(arg => retiredFlags.includes(arg))) throw new Error('Lokala serverpar (--offline, --skip-build och de anslutna lokallägena) är avvecklade. Kör node apps/studio/start.mjs för den publicerade produkten; isolerad prövning sker i staging eller CI. Sparade lokala data bevaras.');
  if (args.some(arg => !['--no-open', '--product'].includes(arg))) throw new Error('Använd node apps/studio/start.mjs [--no-open] för den publicerade produkten.');
  log('Publicerad produkt: ' + publishedProductUrl + '\nBolag → spelrum → dealer. Inga lokala servrar eller externa genereringsanrop startas.');
  if (!args.includes('--no-open')) open(publishedProductUrl);
  return { mode: 'product', url: publishedProductUrl };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
