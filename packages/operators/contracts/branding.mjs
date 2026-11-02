// Shared editable branding contract. N1 owns presentation data and room lanes.
export const PARTNER_BRANDING_FIELDS = Object.freeze(['lane','table','background','dealer','color']);
export const PARTNER_ROOM_BRANDING_FIELDS = Object.freeze(['table','background','dealer','color']);
// The narrow publication can consume the whole draft only when its sole changes
// are one room's material choices. Inheritance changes count even if today's image is equal.
export function isRoomMaterialChange(live, draft, roomId) {
  if (typeof roomId !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(roomId)) return false;
  const before = publicEditableBranding(live), after = publicEditableBranding(draft);
  if (PARTNER_BRANDING_FIELDS.some(key => before[key] !== after[key])) return false;
  let changed = false;
  for (const id of new Set([...Object.keys(before.roomOverrides ?? {}), ...Object.keys(after.roomOverrides ?? {})])) {
    if (id !== roomId && Object.hasOwn(before.roomOverrides ?? {}, id) !== Object.hasOwn(after.roomOverrides ?? {}, id)) return false;
    for (const key of PARTNER_ROOM_BRANDING_FIELDS) {
      if (before.roomOverrides?.[id]?.[key] === after.roomOverrides?.[id]?.[key]) continue;
      if (id !== roomId || !['background','table'].includes(key)) return false;
      changed = true;
    }
  }
  return changed;
}
export function publicEditableBranding(value) {
  const result = {};
  for (const key of PARTNER_BRANDING_FIELDS) if (Object.hasOwn(value ?? {}, key)) result[key] = structuredClone(value[key]);
  if (value?.roomOverrides && typeof value.roomOverrides === 'object' && !Array.isArray(value.roomOverrides)) {
    result.roomOverrides = {};
    for (const [id, entry] of Object.entries(value.roomOverrides)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const clean = {};
      for (const key of PARTNER_ROOM_BRANDING_FIELDS) if (Object.hasOwn(entry,key)) clean[key] = structuredClone(entry[key]);
      Object.defineProperty(result.roomOverrides,id,{value:clean,enumerable:true,configurable:true,writable:true});
    }
  }
  return result;
}
export function resolveRoomBranding(branding, roomId, laneId) {
  const result = publicEditableBranding(branding);
  const overrides = result.roomOverrides;
  delete result.roomOverrides;
  if (laneId && result.lane && result.lane !== laneId) for (const key of PARTNER_ROOM_BRANDING_FIELDS) delete result[key];
  if (roomId && Object.hasOwn(overrides ?? {},roomId)) Object.assign(result,overrides[roomId]);
  if (laneId) result.lane = laneId;
  return result;
}
