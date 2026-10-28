export const BACKOFFICE_SECTIONS: readonly {id: string; label: string}[];
export interface BackofficeGroup {
  readonly id: string;
  readonly label: string;
  readonly area: 'Drift' | 'Administration';
  readonly sections: readonly string[];
}
export const BACKOFFICE_GROUPS: readonly BackofficeGroup[];
export function backofficeGroupId(value: string | undefined): string;
