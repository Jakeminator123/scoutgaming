import type {GameLane, GameLaneId} from '../../../packages/presentation/contracts/game-lanes.mjs';


export function gamePresentationForDealer(dealerId: string, renderer: GameLane['renderer']): 'local';

export function packageLaneIds(allowedLanes: readonly unknown[], lanes?: readonly GameLane[]): string[];
export function gameLaneSelection(query: URLSearchParams | string, activeLane?: string | null, lanes?: readonly GameLane[], allowedLanes?: readonly unknown[]): { lane: string; dealer: string; presentation: 'local' };
export function gameLaneFromDocument(dataset: DOMStringMap, lanes?: readonly GameLane[]): { lane: string; dealer: string; presentation: 'local'; localDealer?: string; registeredDealers?: {id: string; label: string}[]; roomId?: string; operator?: string; packageRevision?: number; branding?: Record<string, unknown>; choices?: { dealers: string[]; dealerDefault: string | null; tableColors: string[]; tableDefault: string | null; background: { enabled: boolean; mode: 'baked' | 'image' | 'video'; allowed: string[]; default: string | null } } };
