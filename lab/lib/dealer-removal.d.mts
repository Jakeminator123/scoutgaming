import type { StudioProject } from './studio-model.mjs';
export interface DealerRemovalStatus {
  kind: 'missing' | 'ready';
  references: { id: string; label: string }[];
  message: string;
}
export function dealerRemovalStatus(project: StudioProject, dealerId: string): DealerRemovalStatus;
