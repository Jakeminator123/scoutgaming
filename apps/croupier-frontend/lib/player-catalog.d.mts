import type { PlayerCatalog } from '../../../packages/player-catalog/index.mjs';
import type { PublicOperatorRooms } from '../../../web/public/operator-rooms-contract.mjs';
export type { PublicOperator, OperatorCatalogueResult } from '../../../packages/player-catalog/index.mjs';
export type RoomCatalogueResult = import('../../../packages/player-catalog/index.mjs').RoomCatalogueResult<PublicOperatorRooms>;
export const operatorPublicView: PlayerCatalog<PublicOperatorRooms>['operatorPublicView'];
export const loadOperatorCatalogue: PlayerCatalog<PublicOperatorRooms>['loadOperatorCatalogue'];
export const loadRoomCatalogue: PlayerCatalog<PublicOperatorRooms>['loadRoomCatalogue'];
