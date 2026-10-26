import { validateRoomGameMaterial } from './room-game-config.mjs';
import { registeredFilmedProfile } from './filmed-profiles/registry.mjs';

export const NATIVE_ROOM_MATERIAL_V2_PREFIX = 'native-film-v2-';
export const isNativeRoomMaterial = material => typeof material?.revision === 'string' && material.revision.startsWith('native-film-');
export const nativeRoomMaterialVersion = material => material?.revision?.startsWith(NATIVE_ROOM_MATERIAL_V2_PREFIX) ? 2 : 1;

// The immutable config carries exact media and the selected shoe topology.
// This projection is shared by the pre-commit guard and browser timeline.
// It never reads a registry, guesses a filename, or creates a media approval.
export function nativeRoomFilmedPlanning(material) {
  if (nativeRoomMaterialVersion(material)!==2) return null;
  validateRoomGameMaterial(material,{dealerId:material.dealerId,language:material.language});
  const profile=registeredFilmedProfile(material.dealerId);
  if(!profile||profile.id!==material.film.profileId)throw Error('native_room_film_profile_mismatch');
  const dealerId=material.dealerId;
  const inventory={videos:material.media.map(row=>({...row,available:true,classification:{dealerId}}))};
  return {profile,inventory,dealerId,transitions:structuredClone(material.film.transitions)};
}
