import { validateRoomGameMaterial } from './room-game-config.mjs';
import { filmedProfileOrPaow } from './filmed-profiles/registry.mjs';
import { expandStudioFilmedProfile } from './filmed-profiles/studio-profile.mjs';

export const NATIVE_ROOM_MATERIAL_V2_PREFIX = 'native-film-v2-';
export const isNativeRoomMaterial = material => typeof material?.revision === 'string' && material.revision.startsWith('native-film-');
export const nativeRoomMaterialVersion = material => material?.revision?.startsWith(NATIVE_ROOM_MATERIAL_V2_PREFIX) ? 2 : 1;

// The immutable config carries exact media and the selected shoe topology.
// This projection is shared by the pre-commit guard and browser timeline.
// It reads only the material's own frozen profile (film v2) or the code
// registry (v1), never guesses a filename or creates a media approval.
export function nativeRoomFilmedPlanning(material) {
  if (nativeRoomMaterialVersion(material)!==2) return null;
  validateRoomGameMaterial(material,{dealerId:material.dealerId,language:material.language});
  // The dealer's own frozen profile (film v2), else its code profile or PAOW's (inherited).
  const profile=material.film.schemaVersion===2?expandStudioFilmedProfile(material.film.profile,{dealerId:material.dealerId})
    :filmedProfileOrPaow(material.dealerId);
  if(!profile||profile.id!==material.film.profileId)throw Error('native_room_film_profile_mismatch');
  const dealerId=material.dealerId;
  const inventory={videos:material.media.map(row=>({...row,available:true,classification:{dealerId}}))};
  return {profile,inventory,dealerId,transitions:structuredClone(material.film.transitions)};
}
