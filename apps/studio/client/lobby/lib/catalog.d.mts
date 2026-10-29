import type { PublicRoomDealer } from '../../../../../packages/presentation/contracts/operator-rooms-contract.mjs';
export type RoomDealer = Dealer & PublicRoomDealer;
export type RoomIllustration = { image: string; alt: string };
export type Dealer = { id: string; name: string; image?: string };
export type Room = {
  id: string; key: string; operatorId: string; name: string;
  game: 'blackjack' | 'roulette'; presentation: string; dealerDefault: string; dealers: RoomDealer[]; playUrl: string;
  environmentLabel: string; environmentFixed: boolean; environmentKind: 'image' | 'video' | 'baked' | 'variable'; image?: string;
  limitPreset?: string; illustration: RoomIllustration;
  /** An open room without published game settings: shown as "Förbereds", no game start. */
  preparing?: boolean;
};
export type Operator = {
  id: string; name: string; monogram: string; accent: string; status: 'open' | 'empty';
  roomIds: string[]; dealerIds: string[];
};
export type LobbyCatalog = { operators: Operator[]; rooms: Room[]; dealers: Dealer[] };
export function roomIllustration(): RoomIllustration;
export function parseLobbyCatalog(payload: unknown): LobbyCatalog;
export function loadLobbyCatalog(options?: { fetchImpl?: typeof fetch; signal?: AbortSignal }): Promise<LobbyCatalog>;
export function lobbySelection(catalog: LobbyCatalog, selected?: { operatorId?: string | null; roomKey?: string | null; dealerId?: string | null }): {
  operator: Operator | null; room: Room | null; dealer: RoomDealer | null; availableRooms: Room[]; availableDealers: RoomDealer[];
};
export function lobbyQuerySelection(catalog: LobbyCatalog, search?: string): {
  operatorId: string | null; roomKey: string | null; dealerId: string | null; unavailable: boolean;
};
export function playUrlFor(selection: { operator: Operator; room: Room; dealer: Dealer }): string | undefined;
