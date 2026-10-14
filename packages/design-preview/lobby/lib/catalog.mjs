import { validatePublicOperatorRooms } from '../../../../web/public/operator-rooms-contract.mjs';
import { roomEnvironment } from '../../../../web/public/room-environment.mjs';

/** Validate the published subcatalog, never use administration objects as playable data. */
export function parseLobbyCatalog(payload) {
  if (payload?.schemaVersion !== 1 || payload.source !== 'registered'
    || !Array.isArray(payload.lobby?.catalogs) || payload.lobby.catalogs.length > 1000) {
    throw new Error('Ogiltig spelkatalog');
  }
  const operators = [], rooms = [], dealerMap = new Map(), seen = new Set();
  for (const raw of payload.lobby.catalogs) {
    const catalog = validatePublicOperatorRooms(raw);
    const { slug, name } = catalog.operator;
    if (seen.has(slug)) throw new Error('Dubblerat spelbolag');
    seen.add(slug);
    const dealerIds = new Set();
    for (const room of catalog.rooms) {
      const environment = roomEnvironment(room, slug);
      for (const dealer of room.dealers) {
        dealerIds.add(dealer.id);
        if (!dealerMap.has(dealer.id)) dealerMap.set(dealer.id, { id: dealer.id, name: dealer.label });
      }
      rooms.push({
        id: room.id, key: `${slug}:${room.id}`, operatorId: slug, name: room.name,
        game: room.game ?? 'blackjack', presentation: room.presentation.label,
        environmentLabel: environment.label, environmentFixed: environment.fixed, environmentKind: environment.kind,
        ...(environment.image ? { image: environment.image } : {}),
        dealers: room.dealers.map(dealer => ({ id: dealer.id, name: dealer.label })),
        playUrl: room.playUrl,
      });
    }
    operators.push({
      id: slug, name, monogram: Array.from(name)[0]?.toLocaleUpperCase('sv') ?? '',
      accent: '#D6EF7C', status: catalog.rooms.length ? 'open' : 'empty',
      roomIds: catalog.rooms.map(room => `${slug}:${room.id}`), dealerIds: [...dealerIds],
    });
  }
  return { operators, rooms, dealers: [...dealerMap.values()] };
}

export async function loadLobbyCatalog({ fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl('/admin/_data/catalog', {
    headers: { accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin',
    redirect: 'error', signal,
  });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403
    ? 'Din session har gått ut. Logga in i administrationen igen.'
    : 'Spelkatalogen kan inte hämtas just nu. Försök igen.');
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error('Spelkatalogen är för stor.');
  return parseLobbyCatalog(JSON.parse(text));
}

/** URL room IDs are scoped by the published operator, never inferred or defaulted. */
export function lobbyQuerySelection(catalog, search = '') {
  const query = new URLSearchParams(search);
  const operatorId = query.getAll('operator').length === 1 ? query.get('operator') : null;
  const roomId = query.getAll('room').length === 1 ? query.get('room') : null;
  const { operator, room } = lobbySelection(catalog, {
    operatorId, roomKey: operatorId && roomId ? operatorId + ':' + roomId : null,
  });
  return {
    operatorId: operator?.id ?? null, roomKey: room?.key ?? null,
    unavailable: query.has('operator') && !operator || query.has('room') && !room,
  };
}
/** Derive each step from the selected parent; stale IDs never broaden access. */
export function lobbySelection(catalog, { operatorId = null, roomKey = null, dealerId = null } = {}) {
  const operator = catalog.operators.find(row => row.id === operatorId) ?? null;
  const availableRooms = catalog.rooms.filter(row => row.operatorId === operator?.id);
  const room = availableRooms.find(row => row.key === roomKey) ?? null;
  const availableDealers = room?.dealers ?? [];
  const dealer = availableDealers.find(row => row.id === dealerId) ?? null;
  return { operator, room, dealer, availableRooms, availableDealers };
}

/** Both tenant and room membership must still match when rendering a launch link. */
export function playUrlFor({ operator, room, dealer }) {
  if (room.operatorId !== operator.id || !operator.roomIds.includes(room.key)
    || !room.dealers.some(row => row.id === dealer.id)) return undefined;
  const canonical = `/play/${room.game}?` + new URLSearchParams({ operator: operator.id, table: room.id });
  if (room.playUrl !== canonical) return undefined;
  return canonical + '&dealer=' + encodeURIComponent(dealer.id);
}
