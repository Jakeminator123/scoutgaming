export type GameLaneId = string;
export type GameLane = { schemaVersion: 1; id: string; label: string; renderer: 'portrait-video' | 'indexed-video'; dealer: string; mediaCollection: `${string}-presentation` | 'legacy-dealers' };
export const GAME_LANES: readonly Readonly<GameLane>[];
export function isGameLane(value: unknown, lanes?: readonly GameLane[]): value is GameLaneId;
export function validateGameLanes(value: unknown): GameLane[];
export function gameLaneConfiguration(value?: {gameLanes?: unknown; gameLane?: unknown}): {gameLanes: GameLane[]; gameLane: string | null};
export function laneDealerSelection(query: URLSearchParams | string, lane: Readonly<GameLane>, dealerLayer?: { default?: unknown; allowed?: readonly unknown[] } | null, options?: {portraitDealerIds?: readonly string[]}): string | null;
