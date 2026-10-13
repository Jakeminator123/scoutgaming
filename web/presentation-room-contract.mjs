import { gameLaneConfiguration, isGameLaneId } from './public/game-lanes.mjs';
import { readPackagePresentation } from './storage/presentation-package.mjs';
import { StudioStorageError } from './storage/studio-contract.mjs';
import { assertPresentationRoomMaterials } from './presentation-material-game.mjs';

export const PRESENTATION_ROOM_SCHEMA_VERSION = 2;
export const PRESENTATION_ROOM_CAPABILITY = 'operator-owned-v2';
const fields = ['schemaVersion', 'id', 'name', 'operatorId', 'presentationLaneId', 'gameLaneId', 'state'];
export const roomGame = room => room && Object.hasOwn(room,'game') ? room.game : 'blackjack';
export const roomPlayPath = (room, slug) => `/play/${roomGame(room)}?` + new URLSearchParams({operator:slug,table:room.id});
const operatorId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);
const name = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 100
  && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
export function isPresentationRoom(room) {
  return Boolean(room && typeof room === 'object' && !Array.isArray(room) && Object.keys(room).length === fields.length + (Object.hasOwn(room,'game') ? 1 : 0)
    && ['blackjack','roulette'].includes(roomGame(room))
    && fields.every(key => Object.hasOwn(room, key)) && room.schemaVersion === PRESENTATION_ROOM_SCHEMA_VERSION
    && isGameLaneId(room.id) && name(room.name) && operatorId(room.operatorId)
    && isGameLaneId(room.presentationLaneId) && isGameLaneId(room.gameLaneId)
    && ['live', 'preview', 'pending'].includes(room.state));
}
// Read historical publication bindings separately from game eligibility.
// A known material mismatch does not erase a publication or unrelated rooms.
export function inspectPackageRooms({ administration, package: pack, operatorId: owner } = {}) {
  if (!Array.isArray(administration?.rooms)) throw new StudioStorageError('studio_corrupt_game_policy');
  if (!operatorId(owner) || pack?.operatorId !== owner || !Array.isArray(pack?.tables) || !Array.isArray(pack?.lanes)) return [];
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
