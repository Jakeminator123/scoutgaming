export interface ClipIdentity {
  id?: string;
  label?: string;
  familyId?: string;
  role?: string;
  relativePath?: string;
}

export function assignClipLabel(clipLabels: Record<string, string> | undefined, clipId: string, text: string): Record<string, string>;
export function applyClipLabel<T extends { clipLabels?: Record<string, string> }>(project: T, clipId: string, text: string): T;
export function clipLabel(clip: ClipIdentity | null | undefined, overrides?: Record<string, string> | null): string;

export function clipSituationLabel(eventId: string, situation: string): string;
