import { isPresentationRoom, isRoomOperatorId } from './presentation-room.mjs';

// The tables of one published operator package (operator_packages.rooms, Studio 023, plan L3).
// V2 room records owned by the package's operator, at most 32 like `tables`,
// and exactly the rooms `tables` lists. Null marks pre-023 publication history;
// historical packages never borrow current rooms and cannot grant play.
export const PACKAGE_ROOMS_MAX = 32;
// 32 rooms with every field at its maximum and a name of 100 escaped quotes is 19905 characters
// of canonical JSON. The same bound is Studio 023's CHECK (ops/neon-studio/migrations.mjs).
export const PACKAGE_ROOMS_MAX_TEXT = 20000;

// A detached copy in the package's given order, or null when the list
// breaks the contract. `tables` stays the sorted id index; the order lives in `rooms`.
export function validatePackageRooms(value, { operatorId, tables } = {}) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > PACKAGE_ROOMS_MAX
    || !isRoomOperatorId(operatorId) || !Array.isArray(tables)) return null;
  const ids = new Set();
  for (const room of value) {
    if (!isPresentationRoom(room) || room.operatorId !== operatorId || ids.has(room.id)) return null;
    ids.add(room.id);
  }
  if (ids.size !== new Set(tables).size || tables.some(id => !ids.has(id))) return null;
  return value.map(room => structuredClone(room));
}

// The one invariant for a package's rooms, shared by the writer (publishWithin) and the readers
// (package-rooms.mjs): the contract above, and every room's environment is in the package's lanes
// and, when the package carries a frozen presentation, in that presentation. Null means corrupt.
export function checkPackageRooms(pack, presentation = null) {
  const rooms = validatePackageRooms(pack?.rooms, { operatorId: pack?.operatorId, tables: pack?.tables });
  if (!rooms || !Array.isArray(pack.lanes) || rooms.some(room => !pack.lanes.includes(room.presentationLaneId)
    || presentation && !presentation.lanes.some(lane => lane.id === room.presentationLaneId))) return null;
  return rooms;
}
