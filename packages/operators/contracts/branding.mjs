// Shared editable branding contract. N1 owns presentation data and room lanes.
export const PARTNER_BRANDING_FIELDS = Object.freeze(['lane','table','background','dealer','color']);
export const PARTNER_ROOM_BRANDING_FIELDS = Object.freeze(['table','background','dealer','color']);
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
