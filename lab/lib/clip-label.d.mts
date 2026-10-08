export interface ClipIdentity {
  id?: string;
  familyId?: string;
  role?: string;
  relativePath?: string;
}

export function clipLabel(clip: ClipIdentity | null | undefined, overrides?: Record<string, string> | null): string;
