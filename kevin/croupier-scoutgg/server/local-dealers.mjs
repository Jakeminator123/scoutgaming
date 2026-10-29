// Kevin 29 Oct ("still images, we need the idle ones"): the server reads the dealers' idle lists from public/dealers.js,
// which adds a local-only dealer (Adebayor) only when globalThis.LOCAL_DEALERS names him. Set that here, from the env,
// before dealers.js is imported, or the server lays no idle chain under his lines and he speaks on the still.
import { loadEnv } from './env.mjs';
loadEnv();
globalThis.LOCAL_DEALERS = (process.env.LOCAL_DEALERS ?? '').split(',').map(s => s.trim()).filter(Boolean);
