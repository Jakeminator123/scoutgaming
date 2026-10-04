export type GameLaneId = 'original' | 'mobile-phone';
export const GAME_LANES: readonly Readonly<{ id: GameLaneId; label: string }>[];
export function isGameLane(value: unknown): value is GameLaneId;
export function gameLaneSelection(query: URLSearchParams | string, activeLane?: GameLaneId): { lane: GameLaneId; dealer: string; presentation: string };
