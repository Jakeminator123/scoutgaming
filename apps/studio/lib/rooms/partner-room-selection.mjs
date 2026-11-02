// An explicit room link must never become company defaults or another room.
export function availablePartnerRooms(snapshot) {
  return (snapshot.tables ?? []).filter(room => room.operatorId === snapshot.operator?.id && room.status === 'active');
}

export function initialPartnerRoomSelection(snapshot, requestedRoomId, requestedScope) {
  const unavailable = { roomId: '', unavailable: true };
  if (requestedScope !== undefined) return requestedScope === 'company' && requestedRoomId === undefined
    ? { roomId: '', unavailable: false } : unavailable;
  const rooms = availablePartnerRooms(snapshot);
  if (requestedRoomId === undefined) return { roomId: rooms[0]?.id ?? '', unavailable: false };
  if (typeof requestedRoomId !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(requestedRoomId)
    || !rooms.some(room => room.id === requestedRoomId)) return unavailable;
  return { roomId: requestedRoomId, unavailable: false };
}

// Keep duplicates/empty values explicit so history cannot turn an invalid link into a default.
export function partnerRoomRequest(search) {
  const value = key => {const all = search.getAll(key); return all.length > 1 ? all : all[0];};
  return { roomId: value('room'), scope: value('scope') };
}

export function partnerRoomQuery({roomId, scope}) {
  const query = new URLSearchParams();
  for (const [key, value] of [['room', roomId], ['scope', scope]]) {
    if (value !== undefined) for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  return query.size ? '?' + query : '';
}
