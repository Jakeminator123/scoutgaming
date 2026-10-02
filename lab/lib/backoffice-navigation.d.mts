export const BACKOFFICE_SECTIONS: readonly {id: string; label: string}[];
export function backofficeSection(value: unknown): string;
export function backofficeOrigin(env?: Record<string, string | undefined>): string | null;
export function backofficeFrameUrl(origin: string | null, section: unknown): string | null;
