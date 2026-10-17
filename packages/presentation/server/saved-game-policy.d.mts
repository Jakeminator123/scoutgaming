import type { StudioProject } from '../contracts/studio-model.mjs';
export type StudioGameScope = Readonly<{ environment: string; workspaceId: string }>;
export type StudioDealerId = 'vera' | 'astrid' | 'amira' | 'mei';
export interface StudioSavedDocument<T = Record<string, unknown>> { kind: string; revision: string; value: T; updatedAt?: string; }
export interface StudioGameRepository {
  scope: StudioGameScope;
  transaction<T>(work: (repository: StudioGameRepository) => Promise<T>, options?: { readOnly?: boolean }): Promise<T>;
  readDocument(kind: 'project' | 'administration'): Promise<StudioSavedDocument | null>;
  saveDocument(kind: 'project' | 'administration', options: { value: unknown; expectedRevision: string; actor: string }): Promise<StudioSavedDocument>;
}
export interface StudioGameSavedPolicy {
  readonly revision: string;
  readonly projectRevision: string;
  readonly administrationRevision: string;
  readonly configurationSource: 'neon/croupier_studio';
  readonly project: StudioProject;
  readonly administration: Record<string, unknown>;
}
export const STUDIO_GAME_CONFIGURATION_SOURCE: 'neon/croupier_studio';
export function studioGamePolicyConfiguration(env?: Record<string, string | undefined>): Readonly<{ scope: StudioGameScope; connectionString: string }> | null;
declare function validateStudioGameAdministration(input: unknown): Record<string, unknown>;
export function exactRegisteredDealerIdle(record: unknown, dealerId: string): boolean;
declare function createStudioGamePolicy(options: {
  repository: StudioGameRepository;
  scope: StudioGameScope;
  dealerIdle: (dealerId: StudioDealerId) => unknown | Promise<unknown>;
}): Readonly<{
  scope: StudioGameScope;
  readSaved(): Promise<StudioGameSavedPolicy>;
  readProject(): Promise<StudioProject>;
  readAdministration(): Promise<StudioSavedDocument>;
  readGameConfiguration(): Promise<Record<string, unknown>>;
  saveProject(value: StudioProject, expectedRevision: string, options?: { actor?: string }): Promise<StudioProject>;
  saveAdministration(value: Record<string, unknown>, expectedRevision: string, options?: { actor?: string }): Promise<StudioSavedDocument>;
  canAssignDealer(dealerId: string): Promise<boolean>;
  projectStore(options?: { actor?: string }): Readonly<{ configurationSource: 'neon/croupier_studio'; load(): Promise<StudioProject>; save(value: StudioProject, expectedRevision: string): Promise<StudioProject> }>;
}>;

export function createSavedGamePolicy(options: { documentContract: {
  validateDocumentValue(kind: string, value: unknown, revision: string, options?: { allowLegacyRead?: boolean }): unknown;
} }): Readonly<{ validateStudioGameAdministration: typeof validateStudioGameAdministration; createStudioGamePolicy: typeof createStudioGamePolicy }>;
