import type { IdlePolicy, IdleRotationClip } from '../../../packages/presentation/runtime/idle-policy.mjs';
import type { VideoInventory } from '../../../packages/presentation/contracts/media-inventory.mjs';
export interface IdleRotationSourceClip extends Pick<IdleRotationClip, 'phase' | 'from' | 'to' | 'weight' | 'head' | 'calm'> {
  id: string; path: string; gitBlobSha: string; sha256: string; bytes: number; frames: number; fps: number; durationMs: number;
}
export interface IdleRotationSource {
  schemaVersion: 1; repository: string; branch: string; ref: string; dealerId: string; sourceDealerId: string;
  selectionPath: string; baseline: string; clips: IdleRotationSourceClip[];
}
export interface PreparedIdleRotationClip extends Pick<IdleRotationClip, 'phase' | 'from' | 'to' | 'head' | 'calm'> {
  id: string; baseline: boolean; selected: boolean; status: 'registered' | 'missing' | 'ambiguous'; videoId: string | null;
}
export interface PreparedIdleRotation {
  dealerId: string; ref: string; baseline: string; total: number; matched: number; selected: number;
  clips: PreparedIdleRotationClip[]; policy: IdlePolicy | null; error: string | null;
}
export const IDLE_ROTATION_DEALERS: readonly string[];
export function validateIdleRotationSource(source: unknown): IdleRotationSource;
export function idleRotationSource(dealerId: string): IdleRotationSource | null;
export function prepareIdleRotation(policy: IdlePolicy, inventory: VideoInventory, options?: { selection?: readonly string[] | null }): PreparedIdleRotation | null;
export function savedIdleRotationSelection(prepared: PreparedIdleRotation, policy: IdlePolicy | null | undefined): { ids: string[]; outside: number };
