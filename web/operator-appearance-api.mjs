import {isGameLaneId} from '../packages/presentation/contracts/game-lane-id.mjs';
import { isOperatorSlug } from '../packages/navigation/operator-slug.mjs';

// Read-only revision acknowledgement. The caller authenticates the player and
// supplies the uncached game-entry selector; no wallet or round is changed here.
export function createOperatorAppearanceApi({selectGameEntry} = {}) {
  if (typeof selectGameEntry !== 'function') throw TypeError('Fresh game-entry reader required');
  return async function response(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/operator/appearance') return null;
    const json = (status, value) => new Response(JSON.stringify(value), {status,
      headers: {'Content-Type':'application/json', 'Cache-Control':'private, no-store'}});
    if (request.method !== 'GET') return new Response(null, {status:405, headers:{Allow:'GET', 'Cache-Control':'private, no-store'}});
    const query = url.searchParams;
    if ([...query.keys()].some(key => !['operator','table','lane'].includes(key) || query.getAll(key).length !== 1)
      || !isOperatorSlug(query.get('operator')) || ['table','lane'].some(key => query.has(key) && !isGameLaneId(query.get(key)))) {
      return json(400, {error:'operator_appearance_invalid'});
    }
    try {
      const entry = await selectGameEntry(query);
      if (entry.status !== 200) return json(404, {error:'operator_appearance_unavailable'});
      const value = entry.selection;
      if (value?.operator !== query.get('operator') || !Number.isSafeInteger(value.packageRevision) || value.packageRevision < 1
        || (value.roomId ?? null) !== (query.get('table') ?? null)) return json(503, {error:'operator_appearance_unavailable'});
      return json(200, {operator:value.operator, roomId:value.roomId ?? null, packageRevision:value.packageRevision});
    } catch { return json(503, {error:'operator_appearance_unavailable'}); }
  };
}
