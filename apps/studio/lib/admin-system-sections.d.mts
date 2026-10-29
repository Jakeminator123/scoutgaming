export const SYSTEM_SECTIONS: readonly {readonly id: string; readonly label: string}[];
export interface SystemGroup {
  readonly id: string;
  readonly label: string;
  readonly area: 'Drift' | 'System';
  readonly sections: readonly string[];
}
export const SYSTEM_GROUPS: readonly SystemGroup[];
