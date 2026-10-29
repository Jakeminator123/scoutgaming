import { gameLaneConfiguration } from '../contracts/game-lanes.mjs';
import { PRESENTATION_ROOM_SCHEMA_VERSION, isPresentationRoom, isRoomOperatorId } from '../contracts/presentation-room.mjs';
import { readPackagePresentation } from './presentation-package.mjs';
import { StudioStorageError } from '../../studio-registry/server/document-contract.mjs';
import { assertPresentationRoomMaterials } from '../contracts/presentation-material-game.mjs';
import { checkPackageRooms } from '../contracts/package-rooms.mjs';


// Read historical publication bindings separately from game eligibility.
// A known material mismatch does not erase a publication or unrelated rooms.
// A package written with `rooms` (Studio 023, plan L3) is the list: the administration document's
// rooms are not read and do not filter it. A package room that breaks the package's own lanes is
// a corrupt package (503), never a silently missing table. Without `rooms`: today's path, unchanged.
export function inspectPackageRooms({ administration, package: pack, operatorId: owner } = {}) {
  const packaged = pack?.rooms !== null && pack?.rooms !== undefined;
  if (!packaged && !Array.isArray(administration?.rooms)) throw new StudioStorageError('studio_corrupt_game_policy');
  if (!isRoomOperatorId(owner) || pack?.operatorId !== owner || !Array.isArray(pack?.tables) || !Array.isArray(pack?.lanes)) return [];
  const presentation = readPackagePresentation(pack);
  if (!presentation) return [];
  let gameLanes;
  try { gameLanes = gameLaneConfiguration(administration).gameLanes; }
  catch { throw new StudioStorageError('studio_corrupt_game_policy'); }
  const result = [], seen = new Set();
  if (packaged) {
    // The same check publishWithin runs before it writes `rooms`, so a written package never fails it.
    const rooms = checkPackageRooms(pack, presentation);
    if (!rooms) throw new StudioStorageError('studio_corrupt_operator');
    // The game adapter stays in the administration document until L3 PR 7; consumers check it too.
    for (const room of rooms) if (gameLanes.some(lane => lane.id === room.gameLaneId)) result.push(inspectMaterials(presentation, room));
    return result;
  }
  for (const room of administration.rooms) {
    if (seen.has(room?.id)) throw new StudioStorageError('studio_corrupt_game_policy');
    seen.add(room?.id);
    if (room?.schemaVersion !== PRESENTATION_ROOM_SCHEMA_VERSION) continue;
    if (!isPresentationRoom(room)) throw new StudioStorageError('studio_corrupt_game_policy');
    if (room.operatorId === owner && pack.tables.includes(room.id)
      && pack.lanes.includes(room.presentationLaneId) && gameLanes.some(lane => lane.id === room.gameLaneId)
      && presentation.lanes.some(lane => lane.id === room.presentationLaneId)) result.push(inspectMaterials(presentation, room));
  }
  return result;
}
// The package's own rooms (Studio 023, plan L3 PR 3) that every room writer sends explicitly with
// its publication: the administration document's rooms for `next.tables`, in the document's order,
// as the writer has just saved them. Null when a table lacks its room or the list breaks the
// readers' invariant (old data): publishWithin then keeps PR 2's path and never refuses the write.
export function packageRoomsFor(administration, next) {
  const rooms = (Array.isArray(administration?.rooms) ? administration.rooms : []).filter(room => room?.schemaVersion === PRESENTATION_ROOM_SCHEMA_VERSION
    && room.operatorId === next.operatorId && next.tables.includes(room.id));
  // A frozen presentation the readers cannot read is not this list's to refuse: today's path decides.
  let presentation;
  try { presentation = readPackagePresentation(next); } catch { return null; }
  return checkPackageRooms({ ...next, rooms }, presentation);
}
function inspectMaterials(presentation, room) {
  let materialsCompatible=true;
  try { assertPresentationRoomMaterials(presentation,room); }
  catch(error) {
    if(!(error instanceof StudioStorageError)||error.code!=='studio_presentation_game_material_mismatch'||error.statusCode!==422)throw error;
    materialsCompatible=false;
  }
  return {room:structuredClone(room),materialsCompatible};
}
// Existing frozen room/dealer/operator grants remain the read authority.
// New catalogue tags cannot revoke a historical publication; publishers check
// the current material contract before issuing a new immutable package.
export function listPackageRooms(input = {}) {
  return inspectPackageRooms(input).map(row=>row.room);
}
export function resolvePackageRoom(input = {}) {
  return listPackageRooms(input).find(room => room.id === input.roomId) ?? null;
}
