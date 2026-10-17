// Exact browser-safe sources. Server factories, project seeds and private app code
// are never served by this allowlist. Old URLs share the canonical source bytes.
const browserContracts = [
  'dealer-identity', 'dealer-speech-profile', 'dealer-compositing', 'dealer-framing',
  'recorded-speech', 'composition-settings', 'background-playback-policy',
  'roulette-idle-contract', 'roulette-start-contract', 'speech-slot-bindings',
  'speech-lines', 'material-catalog', 'background-materials',
  'speech-package', 'astrid-voice-profile',
];
export const presentationPublicModules = Object.freeze([
  {source: 'packages/navigation/operator-slug.mjs',
    paths: ['/packages/navigation/operator-slug.mjs']},
  ...browserContracts.map(name => ({source: 'packages/presentation/contracts/' + name + '.mjs',
    paths: ['/' + name + '.mjs', '/packages/presentation/contracts/' + name + '.mjs',
      ...(name === 'dealer-identity' ? ['/web/public/dealer-identity.mjs'] : [])]})),
  {source: 'packages/presentation/contracts/game-lanes.mjs',
    paths: ['/packages/presentation/contracts/game-lanes.mjs']},
  {source: 'packages/presentation/contracts/game-lane-id.mjs',
    paths: ['/packages/presentation/contracts/game-lane-id.mjs']},
  {source: 'packages/presentation/contracts/layer-asset-contract.mjs',
    paths: ['/packages/presentation/contracts/layer-asset-contract.mjs']},
  ...['live-idle', 'idle-policy'].map(name => ({source: 'packages/presentation/runtime/' + name + '.mjs',
    paths: ['/presentation-runtime/' + name + '.mjs', '/packages/presentation/runtime/' + name + '.mjs']})),
  {source: 'packages/presentation/contracts/policies/idle-policy.seed.json',
    paths: ['/lab/policies/idle-policy.seed.json', '/packages/presentation/contracts/policies/idle-policy.seed.json']},
].map(row => Object.freeze({...row, paths: Object.freeze(row.paths)})));
const sourceByPath = new Map(presentationPublicModules.flatMap(row => row.paths.map(url => [url, row.source])));
export function presentationPublicSource(pathname) { return sourceByPath.get(pathname) ?? null; }
