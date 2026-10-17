import type { StudioProject } from '../../packages/presentation/contracts/studio-model.mjs';
export interface NeonDocumentRepository {
  scope: Readonly<{ environment: string; workspaceId: string }>;
  readDocument(kind: 'project' | 'social-policy'): Promise<{kind: string; revision: string; value: any} | null>;
  saveDocument(kind: 'project' | 'social-policy', options: {value: any; expectedRevision: string; actor: string}): Promise<{kind: string; revision: string; value: any}>;
}
export interface NeonStoreOptions {
  repository: NeonDocumentRepository;
  scope: Readonly<{ environment: string; workspaceId: string }>;
  actor?: string;
}
export function createNeonProjectStore(options: NeonStoreOptions): {
  load(): Promise<StudioProject>; save(next: StudioProject, expectedRevision: string): Promise<StudioProject>;
};
export function createNeonSocialStore(options: NeonStoreOptions): {
  load(): Promise<any>; save(next: any, expectedRevision: string): Promise<any>;
};
