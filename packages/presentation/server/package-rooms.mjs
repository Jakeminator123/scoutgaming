import { gameLaneConfiguration } from '../contracts/game-lanes.mjs';
import { PRESENTATION_ROOM_SCHEMA_VERSION, isPresentationRoom, isRoomOperatorId } from '../contracts/presentation-room.mjs';
import { readPackagePresentation } from './presentation-package.mjs';
import { StudioStorageError } from '../../studio-registry/server/document-contract.mjs';
import { assertPresentationRoomMaterials } from '../contracts/presentation-material-game.mjs';


// Read historical publication bindings separately from game eligibility.
// A known material mismatch does not erase a publication or unrelated rooms.
export function inspectPackageRooms({ administration, package: pack, operatorId: owner } = {}) {
  if (!Array.isArray(administration?.rooms)) throw new StudioStorageError('studio_corrupt_game_policy');
  if (!isRoomOperatorId(owner) || pack?.operatorId !== owner || !Array.isArray(pack?.tables) || !Array.isArray(pack?.lanes)) return [];
  const presentation = readPackagePresentation(pack);
  if (!presentation) return [];
  let gameLanes;
  try { gameLanes = gameLaneConfiguration(administration).gameLanes; }
  catch { throw new StudioStorageError('studio_corrupt_game_policy'); }
  const result = [], seen = new Set();
  for (const room of administration.rooms) {
    if (seen.has(room?.id)) throw new StudioStorageError('studio_corrupt_game_policy');
    seen.add(room?.id);
    if (room?.schemaVersion !== PRESENTATION_ROOM_SCHEMA_VERSION) continue;
    if (!isPresentationRoom(room)) throw new StudioStorageError('studio_corrupt_game_policy');
    if (room.operatorId === owner && pack.tables.includes(room.id)
      && pack.lanes.includes(room.presentationLaneId) && gameLanes.some(lane => lane.id === room.gameLaneId)
      && presentation.lanes.some(lane => lane.id === room.presentationLaneId)) {
      let materialsCompatible=true;
      try { assertPresentationRoomMaterials(presentation,room); }
      catch(error) {
        if(!(error instanceof StudioStorageError)||error.code!=='studio_presentation_game_material_mismatch'||error.statusCode!==422)throw error;
        materialsCompatible=false;
      }
      result.push({room:structuredClone(room),materialsCompatible});
    }
  }
  return result;
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
