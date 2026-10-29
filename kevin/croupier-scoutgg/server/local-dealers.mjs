// Kevin 29 Oct ("still images, we need the idle ones"): the server reads the dealers' idle lists from public/dealers.js,
// which adds a local-only dealer (Adebayor) only when globalThis.LOCAL_DEALERS names him. Set that here, from the env,
// before dealers.js is imported, or the server lays no idle chain under his lines and he speaks on the still.
import { loadEnv } from './env.mjs';
loadEnv();
globalThis.LOCAL_DEALERS = (process.env.LOCAL_DEALERS ?? '').split(',').map(s => s.trim()).filter(Boolean);
// and which of his idle takes are built (v2/meta.json picks), so dealers.js lists only clips that exist
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
try {
  const m = JSON.parse(readFileSync(fileURLToPath(new URL('../public/media/dealers/adebayor/v2/meta.json', import.meta.url)), 'utf8'));
  globalThis.LOCAL_DEALERS_IDLES = Object.keys(m.picks ?? {}).filter(t => !/^(pos|hole|flip)/.test(t));
} catch { globalThis.LOCAL_DEALERS_IDLES = null; }
