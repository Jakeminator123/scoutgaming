// Demo operators shared by the game server and Studio. web/ must not import lab/
// or web/public/ at module top level: the server test copies carry only web/*.mjs
// plus a handful of public modules, and the Render image carries web/ alone.
const reservedOperatorSlugs = new Set(['api', 'auth', 'login', 'logout', 'studio', 'control', 'partner', 'play', 'set-password']);
// Same rule as isOperatorSlug in web/public/game-lanes.mjs and lab/lib/partner-session.mjs.
export const isOperatorSlug = value => typeof value === 'string' && value.length <= 63
  && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && !reservedOperatorSlugs.has(value);

export const DEMO_OPERATORS = Object.freeze([
  Object.freeze({ id: 'operator-demo-north', slug: 'demo-north', name: 'Demo North' }),
  Object.freeze({ id: 'operator-demo-south', slug: 'demo-south', name: 'Demo South' }),
  Object.freeze({ id: 'sg-test', slug: 'sg-test', name: 'SG test game provider' }),
]);
