import { createPlayerCatalog } from '../../../packages/player-catalog/index.mjs';
import { isOperatorSlug } from '../../../packages/navigation/operator-slug.mjs';
import { validatePublicOperatorRooms } from '../../../packages/presentation/contracts/operator-rooms-contract.mjs';
import { parseLobbyCatalog } from '../lobby/lib/catalog.mjs';
export { lobbySelection, lobbyQuerySelection, playUrlFor } from '../lobby/lib/catalog.mjs';

const { loadOperatorCatalogue, loadRoomCatalogue } = createPlayerCatalog({
  isOperatorSlug, validatePublicOperatorRooms,
});

// Share the existing player readers and the lobby projection. The public build
// never calls the staff catalog and never receives saved drafts or admin data.
export async function loadLobbyCatalog({ fetchImpl = fetch, signal } = {}) {
  const directory = await loadOperatorCatalogue({ fetchImpl, signal });
  if (directory.status !== 'ready') throw new Error('Spelkatalogen kan inte hämtas just nu.');
  const catalogs = new Array(directory.operators.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, catalogs.length) }, async () => {
    while (next < catalogs.length) {
      const index = next++, operator = directory.operators[index];
      const result = await loadRoomCatalogue(operator.slug, { fetchImpl, signal });
      if (result.status === 'unavailable') throw new Error('Spelkatalogen kan inte hämtas just nu.');
      if (result.status === 'ready' && result.catalog.rooms.length) catalogs[index] = result.catalog;
    }
  }));
  if (signal?.aborted) throw new Error('Spelkatalogen kunde inte hämtas.');
  return parseLobbyCatalog({ schemaVersion: 1, source: 'registered', lobby: { catalogs: catalogs.filter(Boolean) } });
}
