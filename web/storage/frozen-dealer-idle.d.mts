import type { StudioProject } from '../../lab/lib/studio-model.mjs';
import type { VideoRegistry } from '../../lab/lib/video-registry.mjs';
import type {StudioMediaRecord} from '../managed-media-contract.mjs';

// Reuse the shared managed StudioMediaRecord type; retained bank provenance
// is validated separately by the server storage contract.
export type FrozenStudioMediaRecord = StudioMediaRecord;
export interface FrozenRegisteredDealer { id: string; label: string; idle: FrozenStudioMediaRecord | null; rouletteIdle?:{base:FrozenStudioMediaRecord;variants:FrozenStudioMediaRecord[];foregroundPolygons?:import('../public/roulette-idle-contract.mjs').RouletteForegroundPolygons};rouletteStart?:import('../public/roulette-start-contract.mjs').RouletteStartProfile&{clip:FrozenStudioMediaRecord} }
export type FrozenMediaRow = FrozenStudioMediaRecord & { revision: string; updatedAt?: string };
export interface FrozenMediaPrecondition { id: string; revision: string; record: FrozenStudioMediaRecord }
export function validateFrozenRegisteredDealers(entries: unknown, options: { dealerIds: readonly string[] }): readonly FrozenRegisteredDealer[];
export function captureFrozenRegisteredDealers(input: {
  project: StudioProject; selectedLaneIds: readonly string[]; inventory: VideoRegistry|null; mediaRows: readonly FrozenMediaRow[]|null;
  requiredIdleDealerIds?: readonly string[];
  requiredRouletteIdleDealerIds?: readonly string[];
}): { readonly registeredDealers: readonly FrozenRegisteredDealer[]; readonly mediaPreconditions: readonly FrozenMediaPrecondition[] };
export function resolveFrozenDealerIdle(entries: unknown, options: { dealerId: string; allowedDealerIds: readonly string[];game?:'blackjack'|'roulette' }): FrozenStudioMediaRecord | null;
export function assertFrozenMediaPreconditions(preconditions: readonly FrozenMediaPrecondition[], currentMediaRows: readonly FrozenMediaRow[]): void;
