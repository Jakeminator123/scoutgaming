import { administrationRooms } from '../../presentation/server/administration-room-projection.mjs';
import { createStudioRepository as createRepository } from './repository.mjs';
import * as contract from './document-contract.mjs';
import { isActiveDealerId } from '../../presentation/contracts/dealer-identity.mjs';
import { assertStudioMediaStorageType } from './stored-media-types.mjs';
import { validateRuntimeCatalogRecord } from './runtime-catalog.mjs';
import { validateDealerSetRecordOwners, dealerSetsForClip } from '../../presentation/contracts/dealer-sets.mjs';

const policy = Object.freeze({ isActiveDealerId, assertStudioMediaStorageType });
const runtimeCatalog = Object.freeze({ validateRuntimeCatalogRecord });
const dealerSets = Object.freeze({ validateDealerSetRecordOwners, dealerSetsForClip });

// The application supplies its existing domain rules; the shared repository owns
// all scoped SQL, transactions, CAS, history and snapshot operations together.
export function createStudioRepository({ pool, scope } = {}) {
  return createRepository({ pool, scope, contract, policy, runtimeCatalog, dealerSets, administrationRooms });
}
