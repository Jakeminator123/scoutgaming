import type { StudioProject } from './studio-model.mjs';
export type DealerSet = { id: string; name: string; dealerId: string; clipIds: string[]; archived: boolean };
export function dealerSetErrors(value: unknown, dealerIds: ReadonlySet<string>): string[];
export function createDealerSet(project: StudioProject, input: { id: string; name: string; dealerId: string; clipIds?: string[] }): StudioProject;
export function editDealerSet(project: StudioProject, id: string, patch: Partial<Pick<DealerSet, 'name'|'clipIds'|'archived'>>): StudioProject;
export function removeDealerSet(project: StudioProject, id: string): StudioProject;
export function dealerSetsForClip(project: StudioProject, clipId: string): DealerSet[];
export function validateDealerSetRecordOwners(project: StudioProject, records: { id: string; classification: { dealerId: string; archived?: boolean }; deletion?: unknown }[]): void;
export function validateDealerSetBindings(project: StudioProject, registry: { videos: { id: string; revision?: string; dealer?: string; classification?: { dealerId: string; archived?: boolean }; deletion?: unknown; available: boolean; integrity?: string; sha256?: string; bytes?: number }[] }): void;
