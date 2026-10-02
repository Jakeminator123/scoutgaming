export const BACKOFFICE_SECTIONS: readonly {id: string; label: string}[];
export interface BackofficeGroup {
  readonly id: string;
  readonly label: string;
  readonly sections: readonly string[];
}
export const BACKOFFICE_GROUPS: readonly BackofficeGroup[];
export function backofficeGroup(value: unknown): BackofficeGroup;
export function backofficeSection(value: unknown): string;
export function backofficeOrigin(env?: Record<string, string | undefined>): string | null;
export function backofficeFrameUrl(origin: string | null, section: unknown): string | null;
