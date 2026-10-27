import { registerHooks } from 'node:module';
const server = new URL('../../services/game/server.mjs', import.meta.url).href;
const fixture = new URL('./engine-studio-policy.mjs', import.meta.url).href;
// Preload for an engine started by test/fixtures/engine-qa.mjs with the Studio policy
// runtime: server.mjs's one Studio policy factory import resolves to the loopback
// wrapper. Every other import, including the published chat resolver, stays real.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL === server && specifier === './storage/studio-runtime.mjs') return { url: fixture, shortCircuit: true };
  return nextResolve(specifier, context);
} });
