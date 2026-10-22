const KEYS = ['lane', 'table', 'background', 'dealer', 'color'];
const ROOM_KEYS = KEYS.filter(key => key !== 'lane');
const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const positive = value => Number.isSafeInteger(value) && value > 0;

// Project only the values actually consumed by N3. Omitted values inherit defaults.
export function appearanceBranding(value) {
  const source = object(value) ? value : {};
  const result = Object.fromEntries(KEYS.filter(key => typeof source[key] === 'string' && source[key] !== '').map(key => [key, source[key]]));
  if (object(source.roomOverrides)) {
    const rooms = Object.keys(source.roomOverrides).sort().map(id => {
      const room = source.roomOverrides[id];
      return [id, Object.fromEntries(ROOM_KEYS.filter(key => object(room) && typeof room[key] === 'string' && room[key] !== '').map(key => [key, room[key]]))];
    }).filter(([, room]) => Object.keys(room).length);
    if (rooms.length) result.roomOverrides = Object.fromEntries(rooms);
  }
  return result;
}
export const sameAppearance = (left, right) => JSON.stringify(appearanceBranding(left)) === JSON.stringify(appearanceBranding(right));
export const appearanceDraftRevision = state => state?.draft?.revision ?? state?.draftRevision ?? 0;
export const appearanceDraftBranding = state => appearanceBranding(state?.draft?.branding ?? state?.branding);
export function appearanceReceipt(value, operatorId) {
  if (!object(value) || value.operatorId !== operatorId || !positive(value.packageRevision) || !Array.isArray(value.lanes)
    || !Array.isArray(value.adjustable) || !object(value.branding) || typeof value.canConfigure !== 'boolean'
    || !Object.hasOwn(value, 'draft') || !Number.isSafeInteger(value.draftRevision) || value.draftRevision < 0
    || !Array.isArray(value.history) || !Array.isArray(value.rooms)) return false;
  if (value.draft !== null && (!object(value.draft) || !positive(value.draft.revision) || value.draft.revision !== value.draftRevision
    || !positive(value.draft.basePackageRevision) || !object(value.draft.branding))) return false;
  return value.history.every(row => object(row) && positive(row.revision) && object(row.branding))
    && value.rooms.every(row => object(row) && typeof row.id === 'string' && typeof row.label === 'string' && typeof row.presentationLaneId === 'string'
      && (row.game === undefined || ['blackjack','roulette'].includes(row.game)));
}
export function appearanceReview(value, { draftRevision, packageRevision, branding }) {
  return object(value) && typeof value.reviewToken === 'string' && value.reviewToken.length > 0 && value.reviewToken.length <= 4096
    && value.draftRevision === draftRevision && value.packageRevision === packageRevision && sameAppearance(value.branding, branding)
    && Array.isArray(value.affectedRooms) && value.affectedRooms.every(id => typeof id === 'string')
    && Array.isArray(value.changes) && value.changes.every(row => object(row) && (row.roomId === null || typeof row.roomId === 'string')
      && (KEYS.includes(row.key) || ROOM_KEYS.some(key => row.key === 'roomOverrides.' + key)) && [row.before, row.after].every(item => item === null || typeof item === 'string'));
}
export function changeAppearance(value, { roomId = null, key, selection }) {
  const result = appearanceBranding(value);
  if (!KEYS.includes(key) || roomId !== null && key === 'lane') return result;
  const target = roomId === null ? result : { ...(result.roomOverrides?.[roomId] ?? {}) };
  if (selection === '' || selection === null) delete target[key]; else target[key] = selection;
  if (roomId !== null) result.roomOverrides = { ...(result.roomOverrides ?? {}), [roomId]: target };
  if (roomId === null && key === 'lane' && selection !== value?.lane) for (const field of ROOM_KEYS) delete result[field];
  return appearanceBranding(result);
}
export function resetAppearanceRoom(value, roomId) {
  const result = appearanceBranding(value);
  if (result.roomOverrides) delete result.roomOverrides[roomId];
  return appearanceBranding(result);
}

// What the player meets now in one room: the published choice, the inherited
// company choice for the same composition, else the composition default.
export function appearanceRoomStatus(state, roomId) {
  const room = state?.rooms?.find(row => row.id === roomId);
  const lane = state?.presentation?.lanes?.find(row => row.id === room?.presentationLaneId);
  if (!room || !lane) return null;
  const published = appearanceBranding(state.branding);
  const inherited = (published.lane ?? state.presentation.lanes[0]?.id) === lane.id ? published : {};
  const override = published.roomOverrides?.[room.id] ?? {};
  const live = Object.fromEntries(['background', 'dealer', 'table'].map(key => [key, override[key] ?? inherited[key] ?? lane.layers?.[key]?.default ?? null]));
  return { roomId: room.id, laneId: lane.id, packageRevision: state.packageRevision, draftRevision: appearanceDraftRevision(state), draft: Boolean(state.draft), live };
}
