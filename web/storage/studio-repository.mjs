import { createStudioRepository as createRepository } from '../../packages/studio-registry/server/repository.mjs';
import * as contract from './studio-contract.mjs';
import { isActiveDealerId } from '../dealer-identity.mjs';
import { assertStudioMediaStorageType } from './studio-media-storage.mjs';
import { validateRuntimeCatalogRecord } from './runtime-media-catalog.mjs';
import { validateDealerSetRecordOwners, dealerSetsForClip } from '../../lab/lib/dealer-sets.mjs';

const policy = Object.freeze({ isActiveDealerId, assertStudioMediaStorageType });
const runtimeCatalog = Object.freeze({ validateRuntimeCatalogRecord });
const dealerSets = Object.freeze({ validateDealerSetRecordOwners, dealerSetsForClip });

// The application supplies its existing domain rules; the shared repository owns
// all scoped SQL, transactions, CAS, history and snapshot operations together.
export function createStudioRepository({ pool, scope } = {}) {
  return createRepository({ pool, scope, contract, policy, runtimeCatalog, dealerSets });
}
