import { createPlayerCatalog } from '../../../packages/player-catalog/index.mjs';
import { isOperatorSlug } from '../../../packages/navigation/operator-slug.mjs';
import { validatePublicOperatorRooms } from '../../../web/public/operator-rooms-contract.mjs';

export const { operatorPublicView, loadOperatorCatalogue, loadRoomCatalogue } = createPlayerCatalog({
  isOperatorSlug, validatePublicOperatorRooms,
});
