import {isActiveDealerId} from '../../../web/dealer-identity.mjs';
import {ownDealerIdle} from '../runtime/registered-idle.mjs';
export function createRegisteredDealerIdle({registryLoader} = {}) {
  if (typeof registryLoader !== 'function') throw new TypeError('Explicit cloud media registry required');
  return async (dealerId, project) => {
    if (!isActiveDealerId(dealerId)) return null;
    const video = ownDealerIdle(project, await registryLoader(), dealerId);
    return video ? {dealerId, mediaId:video.id, sha256:video.sha256, available:true} : null;
  };
}
