import { gameLaneConfiguration } from '../contracts/game-lanes.mjs';
import { PRESENTATION_ROOM_SCHEMA_VERSION, isRoomOperatorId } from '../contracts/presentation-room.mjs';
import { readPackagePresentation } from './presentation-package.mjs';
import { StudioStorageError } from '../../studio-registry/server/document-contract.mjs';
import { assertPresentationRoomMaterials } from '../contracts/presentation-material-game.mjs';
import { checkPackageRooms } from '../contracts/package-rooms.mjs';


// Only a trusted server reader may supply roomAuthorityPackage: shared-table
// access has validated the locked config/source chain before selecting its old
// media package. Current package rooms still own state, identity and access.
export function packageRoomAuthority(pack, roomAuthorityPackage = pack, presentation = null) {
  const authority = roomAuthorityPackage ?? pack;
  if (!authority || authority.operatorId !== pack?.operatorId) throw new StudioStorageError('studio_corrupt_operator');
  if (authority !== pack && (!Number.isSafeInteger(authority.revision) || !Number.isSafeInteger(pack.revision)
    || authority.revision < pack.revision)) throw new StudioStorageError('studio_corrupt_operator');
  if (authority.rooms === null || authority.rooms === undefined) return [];
  const rooms = checkPackageRooms(authority, authority === pack ? presentation : null);
  if (!rooms) throw new StudioStorageError('studio_corrupt_operator');
  return rooms.filter(room => pack.tables.includes(room.id) && pack.lanes.includes(room.presentationLaneId)
    && (!presentation || presentation.lanes.some(lane => lane.id === room.presentationLaneId)));
}
// Rooms are granted only by their exact immutable package. Pre-023 packages
// remain inspectable history, but cannot acquire today's rooms or grant play.
export function inspectPackageRooms({ administration, package: pack, roomAuthorityPackage, operatorId: owner } = {}) {
  if (!isRoomOperatorId(owner) || pack?.operatorId !== owner || !Array.isArray(pack?.tables) || !Array.isArray(pack?.lanes)) return [];
  if (!roomAuthorityPackage && (pack.rooms === null || pack.rooms === undefined)) return [];
  const presentation = readPackagePresentation(pack);
  if (!presentation) return [];
  const rooms = packageRoomAuthority(pack, roomAuthorityPackage, presentation);
  let gameLanes;
  try { gameLanes = gameLaneConfiguration(administration).gameLanes; }
  catch { throw new StudioStorageError('studio_corrupt_game_policy'); }
  return rooms.filter(room => gameLanes.some(lane => lane.id === room.gameLaneId))
    .map(room => inspectMaterials(presentation, room));
}
// Publication candidates derive rooms from the server's package projection,
// including the pending room mutation. No stored administration list is read.
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
