// An explicit room link must never become company defaults or another room.
export function availablePartnerRooms(snapshot) {
  return (snapshot.tables ?? []).filter(room => room.operatorId === snapshot.operator?.id && room.status === 'active');
}

export function initialPartnerRoomSelection(snapshot, requestedRoomId) {
  const rooms = availablePartnerRooms(snapshot);
  if (requestedRoomId === undefined) return { roomId: rooms[0]?.id ?? '', unavailable: false };
  if (typeof requestedRoomId !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(requestedRoomId)
    || !rooms.some(room => room.id === requestedRoomId)) return { roomId: '', unavailable: true };
  return { roomId: requestedRoomId, unavailable: false };
}
