import { createStudioRepository as createRepository } from '../../packages/studio-registry/server/repository.mjs';
import * as contract from './studio-contract.mjs';
import { isActiveDealerId } from '../../packages/presentation/contracts/dealer-identity.mjs';
import { assertStudioMediaStorageType } from '../../packages/studio-registry/server/stored-media-types.mjs';
import { validateRuntimeCatalogRecord } from '../../packages/studio-registry/server/runtime-catalog.mjs';
import { validateDealerSetRecordOwners, dealerSetsForClip } from '../../packages/presentation/contracts/dealer-sets.mjs';

const policy = Object.freeze({ isActiveDealerId, assertStudioMediaStorageType });
const runtimeCatalog = Object.freeze({ validateRuntimeCatalogRecord });
const dealerSets = Object.freeze({ validateDealerSetRecordOwners, dealerSetsForClip });

// The application supplies its existing domain rules; the shared repository owns
// all scoped SQL, transactions, CAS, history and snapshot operations together.
export function createStudioRepository({ pool, scope } = {}) {
  return createRepository({ pool, scope, contract, policy, runtimeCatalog, dealerSets });
}
