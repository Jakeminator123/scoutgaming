import { isOperatorSlug } from '../packages/navigation/operator-slug.mjs';
import { clipCompositing } from '../packages/presentation/runtime/presentation-composition.mjs';

const PATH = /^\/api\/operators\/([^/]+)\/rooms$/;
const unavailable = () => { throw Error('operator_rooms_unavailable'); };
class UnplayableOperatorRooms extends Error {
  constructor(slug) { super('operator_rooms_unavailable'); this.operatorSlug = slug; }
}
export function isUnplayableOperatorRooms(error, slug) {
  return error instanceof UnplayableOperatorRooms && error.operatorSlug === slug;
}
const UNPLAYABLE_SELECTION_ERRORS = new Set(['presentation_dealer_unavailable', 'presentation_dealer_not_configured',
  'presentation_dealer_mismatch', 'presentation_lane_unavailable']);
export function supportsIndependentLayers(selection, frozen, dealerId, game='blackjack') {
  if (selection.presentation === 'original' || !selection.composition) return false;
  const dealer = frozen.registeredDealers?.find(item => item.id === dealerId);
  if (!dealer) return false;
  const composited = media => Boolean(media && clipCompositing(media.classification.compositing));
  if(game==='roulette') return !dealer.rouletteIdle||composited(dealer.rouletteIdle.base)&&dealer.rouletteIdle.variants.every(composited);
  if(game!=='blackjack') return false;
  if (!composited(dealer.idle)) return false;
  const policy = frozen.playback?.dealerIdlePolicies?.find(item => item.dealerId === dealerId)?.policy;
  // Every weighted base uses its own keying settings or the legacy default.
  // Historical full-frame metadata does not revoke explicit layer grants.
  return !policy || policy.base.every(item => composited(frozen.playback.media.find(media => media.id === item.videoId)));
}
function publicLayer(selection, role, independentLayers, defaults) {
  const composition = selection.composition, source = composition?.[role];
  const enabled = independentLayers && source?.enabled === true
    && (role !== 'background' || source.mode !== 'baked' || source.allowed.length > 0);
  const allowed = enabled ? source.allowed.map(id => {
    const asset = composition.assets.find(item => item.id === id && item.role === role);
    if (!asset) unavailable();
    return { id, label: asset.label };
  }) : [];
  const preferred = role === 'table' ? defaults.tableValue : defaults.backgroundValue;
  const value = allowed.some(item => item.id === preferred) ? preferred
    : allowed.some(item => item.id === source?.default) ? source.default : null;
  // The public contract describes the selected independent asset, while the
  // historical package retains its original baked marker unchanged.
  const mode = role === 'background' && enabled && source.mode === 'baked'
    ? (composition.assets.find(item => item.id === (value ?? allowed[0].id)).contentType.startsWith('video/') ? 'video' : 'image')
    : source?.mode;
  return { enabled, default: value, allowed, ...(role === 'background' ? { mode: enabled ? mode : 'baked' } : {}) };
}

/** Anonymous read-only directory. Its store is the same validated, scoped
 * operator store used by the public name endpoint. No fixture rooms, draft
 * presentation fallback, private media, player state or launch tokens. */
export function createPublicOperatorRooms({ store = null, policy = null } = {}) {
  if (store !== null && (typeof store.getOperatorBySlug !== 'function' || typeof store.getCurrentPackage !== 'function')
    || policy !== null && (typeof policy.readSaved !== 'function' || typeof policy.readGameConfiguration !== 'function')) throw TypeError('Invalid operator rooms reader');
  async function read(slug) {
    if (!isOperatorSlug(slug)) return null;
    if (!store || !policy) unavailable();
    // SQLite/offline hosts have no Studio storage runtime. Keep their public
    // unavailable response independent of modules from that optional runtime.
    const [{ createGameEntrySelector }, { listPackageRooms }, { readPackagePresentation }, { resolvePlayerSelection }, { validatePublicOperatorRooms }] = await Promise.all([
      import('./game-entry-operator.mjs'), import('../packages/presentation/server/package-rooms.mjs'), import('../packages/presentation/server/presentation-package.mjs'),
      import('../packages/presentation/runtime/player-choices.mjs'), import('../packages/presentation/contracts/operator-rooms-contract.mjs'),
    ]);
    const operator = await store.getOperatorBySlug(slug);
    if (!operator || operator.status !== 'active' || operator.slug !== slug) return null;
    const pack = await store.getCurrentPackage(operator.id);
    const result = { schemaVersion: 1, operator: { slug, name: operator.name }, packageRevision: pack?.revision ?? null, rooms: [] };
    if (!pack) return validatePublicOperatorRooms(result, { operatorSlug: slug });
    if (pack.operatorId !== operator.id) unavailable();
    const frozen = readPackagePresentation(pack);
    if (!frozen) return validatePublicOperatorRooms(result, { operatorSlug: slug });
    const saved = await policy.readSaved();
    const rooms = listPackageRooms({ administration: saved.administration, package: pack, operatorId: operator.id }).filter(room => room.state === 'live');
    // All choices in this response use the same saved snapshot and immutable
    // package. Delegate exact room ownership, version and renderer checks to
    // the actual game selector instead of duplicating its authority.
    const select = createGameEntrySelector({
      policy: { readSaved: async () => saved, readGameConfiguration: policy.readGameConfiguration },
      packages: { resolve: async () => ({ operator, package: pack }) }, log: () => {}, game:'any',
    });
    // Ownership and frozen-package validation have already passed. This selector
    // uses only the saved inputs above; storage errors must never receive this
    // operator-specific marker or be hidden by the public directory.
    async function playableEntry(query) {
      let entry;
      try { entry = await select(query); }
      catch (error) {
        if (error?.message === 'Registered cloud presentation required'
          || error?.statusCode === 503 && UNPLAYABLE_SELECTION_ERRORS.has(error.message)) throw new UnplayableOperatorRooms(slug);
        throw error;
      }
      if (entry.status === 404) throw new UnplayableOperatorRooms(slug);
      return entry;
    }
    for (const room of rooms) {
      const game = room.game ?? 'blackjack';
      if (!pack.games?.includes(game)) continue;
      const query = new URLSearchParams({ operator: slug, table: room.id });
      const base = await playableEntry(query);
      if (base.status !== 200 || base.selection.roomId !== room.id) unavailable();
      const initial = resolvePlayerSelection({ choices: base.selection.choices, currentDealer: base.selection.dealer,
        branding: base.selection.branding, composition: base.selection.composition });
      const lane = frozen.lanes.find(item => item.id === room.presentationLaneId), dealers = [];
      for (const id of base.selection.choices.dealers) {
        query.set('dealer', id);
        const entry = await playableEntry(query), selection = entry.selection;
        if (entry.status !== 200 || selection?.dealer !== id || selection.roomId !== room.id || selection.packageRevision !== pack.revision) unavailable();
        const label = frozen.registeredDealers?.find(item => item.id === id)?.label;
        if (!label) unavailable();
        const independentLayers = supportsIndependentLayers(selection, frozen, id, game);
        const defaults = resolvePlayerSelection({ choices: selection.choices, currentDealer: id,
          branding: selection.branding, composition: selection.composition });
        dealers.push({ id, label, presentation: selection.presentation, independentLayers,
          table: publicLayer(selection, 'table', independentLayers, defaults),
          background: publicLayer(selection, 'background', independentLayers, defaults) });
      }
      result.rooms.push({ id: room.id, name: room.name, laneId: room.gameLaneId, ...(game === 'roulette' ? {game} : {}),
        presentation: { id: lane.id, label: lane.label }, dealerDefault: initial.dealer, dealers,
        playUrl: `/play/${game}?` + new URLSearchParams({ operator: slug, table: room.id }).toString() });
    }
    return validatePublicOperatorRooms(result, { operatorSlug: slug });
  }
  async function handle(req, res, pathname) {
    const match = PATH.exec(pathname);
    if (!match) return false;
    const send = (status, value, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(value));
    };
    if (!['GET', 'HEAD'].includes(req.method)) { send(405, { error: 'method_not_allowed' }, { Allow: 'GET, HEAD' }); return true; }
    if (new URL(req.url ?? pathname, 'http://local').search) { send(400, { error: 'invalid_query' }); return true; }
    let slug;
    try { slug = decodeURIComponent(match[1]); } catch { slug = ''; }
    try {
      const value = await read(slug);
      send(value ? 200 : 404, value ?? { error: 'not_found' });
    } catch { send(503, { error: 'operator_rooms_unavailable' }); }
    return true;
  }
  return Object.freeze({ read, handle });
}
