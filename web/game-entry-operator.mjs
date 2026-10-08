// Server-owned /blackjack selection with optional operator context. Without
// ?operator= the lane, dealer and presentation stay on the saved catalogue
// path. gameChoices is still attached from the active presentation lane so
// the player can choose before a company exists. A package and a presentation
// lane only narrow lanes and dealers the catalogue already renders; they
// never add a lane, dealer or renderer. Wallet, cards, shoe and payouts are
// not read or written here.
import { gameChoicesForLane, gameLaneConfiguration, gameLaneSelection, isOperatorSlug, laneDealerSelection, packageLaneIds } from './public/game-lanes.mjs';

export const OPERATOR_NOT_FOUND_HTML = '<!doctype html><html lang="sv"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Bolaget finns inte</title></head>'
  + '<body><main><h1>Bolaget finns inte</h1><p>Adressen pekar på ett spelbolag som inte finns.</p></main></body></html>';

// undefined: no operator context. null: present, but not exactly one valid slug.
export function requestedOperator(params) {
  if (!params.has('operator')) return undefined;
  const values = params.getAll('operator');
  return values.length === 1 && isOperatorSlug(values[0]) ? values[0] : null;
}

const MAX_WARNINGS = 256;

export function createGameEntrySelector({ policy, packages = null, log = console.warn } = {}) {
  if (typeof policy?.readGameConfiguration !== 'function' || typeof policy?.readSaved !== 'function') throw new TypeError('Invalid game policy');
  if (packages !== null && typeof packages?.resolve !== 'function') throw new TypeError('Invalid operator package reader');
  if (typeof log !== 'function') throw new TypeError('Invalid game entry log');
  const warned = new Set();
  function warnOnce(key, message) {
    if (warned.has(key)) return;
    if (warned.size >= MAX_WARNINGS) warned.clear();
    warned.add(key);
    log(message);
  }
  function withChoices(selection, saved, gameLanes) {
    const serverLane = gameLanes.find(row => row.id === selection.lane);
    return { ...selection, choices: gameChoicesForLane(saved?.project?.lanes, selection.lane, serverLane) };
  }
  // { status: 200, selection } or { status: 404 }. Policy failures reject, as today.
  return async function selectGameEntry(query) {
    const params = query instanceof URLSearchParams ? query : new URLSearchParams(query);
    const slug = requestedOperator(params);
    // N3.4: gameChoices follows the active presentation lane even before a
    // company is selected. Lane, dealer and presentation stay on the catalogue
    // rules, and this path still does not query operator storage.
    if (slug === undefined) {
      const saved = await policy.readSaved();
      const { gameLane, gameLanes } = gameLaneConfiguration(saved.administration);
      return { status: 200, selection: withChoices(gameLaneSelection(params, gameLane, gameLanes), saved, gameLanes) };
    }
    if (slug === null) return { status: 404 };
    const [saved, context] = await Promise.all([policy.readSaved(), packages ? packages.resolve(slug) : null]);
    const { gameLane, gameLanes } = gameLaneConfiguration(saved.administration);
    const base = gameLaneSelection(params, gameLane, gameLanes);
    // Unreadable operator storage: today's entry, no guess about the slug.
    if (context === null) return { status: 200, selection: withChoices(base, saved, gameLanes) };
    if (!context.operator) return { status: 404 };
    const current = context.package;
    if (!current) return { status: 200, selection: withChoices({ ...base, operator: slug }, saved, gameLanes) };
    let selection = base;
    if (packageLaneIds(current.lanes, gameLanes).length) selection = gameLaneSelection(params, gameLane, gameLanes, current.lanes);
    else warnOnce(`lanes:${slug}:${current.revision}`,
      `[operator-package] ${slug} r${current.revision}: no package lane in the saved catalogue; using ${selection.lane}`);
    const lane = gameLanes.find(row => row.id === selection.lane);
    const presentationLane = Array.isArray(saved.project?.lanes) ? saved.project.lanes.find(row => row?.id === selection.lane) : undefined;
    if (presentationLane) {
      const dealer = laneDealerSelection(params, lane, presentationLane.layers?.dealer);
      if (dealer) selection = { ...selection, dealer };
      else warnOnce(`dealer:${saved.projectRevision}:${selection.lane}`,
        `[operator-package] lane ${selection.lane}: presentation lane and server lane share no dealer; using ${selection.dealer}`);
    }
    return { status: 200, selection: withChoices({ ...selection, operator: slug, packageRevision: current.revision, branding: current.branding }, saved, gameLanes) };
  };
}
