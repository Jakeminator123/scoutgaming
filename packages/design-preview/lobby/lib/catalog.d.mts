export type Dealer = { id: string; name: string; image?: string };
export type Room = {
  id: string; key: string; operatorId: string; name: string;
  game: 'blackjack' | 'roulette'; presentation: string; dealers: Dealer[]; playUrl: string;
  environmentLabel: string; environmentFixed: boolean; environmentKind: 'image' | 'video' | 'baked' | 'variable'; image?: string;
};
export type Operator = {
  id: string; name: string; monogram: string; accent: string; status: 'open' | 'empty';
  roomIds: string[]; dealerIds: string[];
};
export type LobbyCatalog = { operators: Operator[]; rooms: Room[]; dealers: Dealer[] };
export function parseLobbyCatalog(payload: unknown): LobbyCatalog;
export function loadLobbyCatalog(options?: { fetchImpl?: typeof fetch; signal?: AbortSignal }): Promise<LobbyCatalog>;
export function lobbySelection(catalog: LobbyCatalog, selected?: { operatorId?: string | null; roomKey?: string | null; dealerId?: string | null }): {
  operator: Operator | null; room: Room | null; dealer: Dealer | null; availableRooms: Room[]; availableDealers: Dealer[];
};
export function lobbyQuerySelection(catalog: LobbyCatalog, search?: string): {
  operatorId: string | null; roomKey: string | null; unavailable: boolean;
};
export function playUrlFor(selection: { operator: Operator; room: Room; dealer: Dealer }): string | undefined;
