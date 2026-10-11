import { registeredDealerIds } from '../../web/dealer-identity.mjs';
import { StudioStorageError } from '../../web/storage/studio-contract.mjs';

export async function savedVideoDealerIds(repository) {
  if (typeof repository?.readDocument !== 'function') throw new StudioStorageError('studio_dealer_registry_unavailable');
  const saved = await repository.readDocument('project');
  try { return registeredDealerIds(saved?.value); }
  catch { throw new StudioStorageError('studio_dealer_registry_unavailable'); }
}
// Archived ownership is only for reading the trash, never new uploads/classification.
export async function savedVideoDealerOwnership(repository) {
  const saved = await repository.readDocument('project');
  const active = registeredDealerIds(saved?.value);
  const trash = new Set((saved.value.dealerTrash ?? []).map(entry => entry.dealer.id));
  return {active,trash};
}
export async function requireSavedVideoDealer(repository, dealerId) {
  if (!(await savedVideoDealerIds(repository)).has(dealerId)) throw new StudioStorageError('studio_dealer_not_registered', 422);
}
