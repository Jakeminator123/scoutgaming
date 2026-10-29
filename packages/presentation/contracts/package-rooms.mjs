import { isPresentationRoom, isRoomOperatorId } from './presentation-room.mjs';

// The tables of one published operator package (operator_packages.rooms, Studio 023, plan L3).
// The same v2 room records as administration.rooms[] today, owned by the package's operator,
// at most 32 like `tables`, and exactly the rooms `tables` lists. Null before 023 or before a
// package was written with rooms; then the readers keep the administration document (fallback).
export const PACKAGE_ROOMS_MAX = 32;
export const PACKAGE_ROOMS_MAX_TEXT = 16000;

// A detached copy sorted by id, or null when the list breaks the contract.
export function validatePackageRooms(value, { operatorId, tables } = {}) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > PACKAGE_ROOMS_MAX
    || !isRoomOperatorId(operatorId) || !Array.isArray(tables)) return null;
  const ids = new Set();
  for (const room of value) {
    if (!isPresentationRoom(room) || room.operatorId !== operatorId || ids.has(room.id)) return null;
    ids.add(room.id);
  }
  if (ids.size !== new Set(tables).size || tables.some(id => !ids.has(id))) return null;
  return value.map(room => structuredClone(room)).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
