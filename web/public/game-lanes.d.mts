export type GameLaneId = string;
export type GameLane = { schemaVersion: 1; id: string; label: string; renderer: 'portrait-video' | 'indexed-video'; dealer: string; mediaCollection: 'astrid-presentation' | 'legacy-dealers' };
export const GAME_LANES: readonly Readonly<GameLane>[];
export function isGameLaneId(value: unknown): value is string;
export function isGameLane(value: unknown, lanes?: readonly GameLane[]): value is GameLaneId;
export function validateGameLanes(value: unknown): GameLane[];
export function gameLaneConfiguration(value?: {gameLanes?: unknown; gameLane?: unknown}): {gameLanes: GameLane[]; gameLane: string | null};
export function gameLaneSelection(query: URLSearchParams | string, activeLane?: string | null, lanes?: readonly GameLane[]): { lane: string; dealer: string; presentation: string };
export function gameLaneFromDocument(dataset: DOMStringMap): { lane: string; dealer: string; presentation: string };
