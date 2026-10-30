import {registeredFilmedProfile} from '../../../packages/presentation/contracts/filmed-profiles/registry.mjs';
import {expandStudioFilmedProfile} from '../../../packages/presentation/contracts/filmed-profiles/studio-profile.mjs';
export {registeredFilmedProfile};

// The dealer's landings as the room's locked configuration carries them: the room
// material's frozen profile (film v2), else the package row's frozen profile
// (config.filmedProfile). The code register only when the package has none
// (dragan, paow), so their layout is unchanged. Never a new or live read.
export function frozenFilmedProfile(dealerId,{filmedMaterial=null,filmedProfile=null}={}) {
  const compact=filmedMaterial?.dealerId===dealerId&&filmedMaterial.film?.schemaVersion===2?filmedMaterial.film.profile:filmedProfile;
  return compact?expandStudioFilmedProfile(compact,{dealerId}):registeredFilmedProfile(dealerId);
}
