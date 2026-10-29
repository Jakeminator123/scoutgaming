export interface PublicRoomChoice { id: string; label: string }
export interface PublicRoomLayer { enabled: boolean; default: string | null; allowed: PublicRoomChoice[] }
export interface PublicRoomDealer {
  id: string; label: string; presentation: 'local' | 'original' | 'layered'; independentLayers: boolean;
  table: PublicRoomLayer; background: PublicRoomLayer & { mode: 'baked' | 'image' | 'video' };
}
export interface PublicOperatorRoom {
  game?: 'blackjack' | 'roulette';
  /** The published bet profile's key (casual, prive, high); absent when the room has no published game settings. */
  limitPreset?: string;
  /** The published environment's miljöbild (an illustration material id), for the lobby's picture; absent without one. */
  illustration?: string;
  id: string; name: string; laneId: string; presentation: { id: string; label: string };
  dealerDefault: string; dealers: PublicRoomDealer[]; playUrl: string;
}
export interface PublicOperatorRooms {
  schemaVersion: 1; operator: { slug: string; name: string }; packageRevision: number | null; rooms: PublicOperatorRoom[];
}
export function validatePublicOperatorRooms(value: unknown, options?: { operatorSlug?: string }): PublicOperatorRooms;
