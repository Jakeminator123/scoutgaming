export type MovingDriftMode = 'off' | 'saving' | 'warm';
interface CommandBase { expectedRevision: number; commandId: string; }
export type MovingDriftCommand = CommandBase & (
  | { mode: 'off' }
  | { mode: 'saving'; profileId: string }
  | { mode: 'warm'; profileId: string; durationSeconds: 1800 | 7200 | 86400 }
);
export interface MovingDriftAdminStatus {
  schemaVersion: 1; revision: number; operationId: string | null; serverNowMs: number;
  desired: { mode: MovingDriftMode; profileId: string | null; endsAtMs: number | null };
  observed: { status: 'unknown' | 'off' | 'starting' | 'loading' | 'ready' | 'stopping' | 'error'; atMs: number | null; reasonCode: string | null };
  profiles: { id: string; label: string }[]; selectedProfileId: string | null;
  actual: { profileId: string | null; gpu: string | null; workerId: string | null };
  readiness: { modelReady: boolean; releaseMatches: boolean; bankMatches: boolean };
  admission: { allowed: boolean; reasonCode: string | null };
  capabilities: { connected: boolean; allowedModes: MovingDriftMode[]; reasonCode: string | null };
  cost: { estimatedMicroUsd: number | null; source: string | null; quotedAtMs: number | null; shutdownTailMs: number | null };
}
export function publicMovingDriftStatus(value: any): MovingDriftAdminStatus;
export function publicMovingDriftError(error: unknown): { status: number; body: { error: string; code: string } } | null;