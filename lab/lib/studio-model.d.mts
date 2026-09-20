export type DealerId = 'astrid' | 'vera' | 'amira' | 'mei';
export type SourceType = 'speak' | 'deal' | 'reveal' | 'settle' | 'turn' | 'idle';
export type TriggerCategory = 'deterministic' | 'social' | 'temperament';
export type PredicateOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'includes' | 'all_eq' | 'in' | 'exists';
export type Scalar = string | number | boolean | null;
export interface StudioTrigger { id: string; label: string; category: TriggerCategory; path: string; op: PredicateOperator; value: Scalar | Scalar[] }
export interface VariantSelection { rules: boolean; model: boolean; random: boolean }
export interface StudioVariant { id: string; label: string; priority: number; triggerIds: string[]; assetId: string; videoGenerationId: string | null; selection?: VariantSelection }
export interface StudioLine { dealerId: DealerId; eventId: string; label: string; baselineVariantId: string; variants: StudioVariant[] }
export interface StudioEvent { id: string; label: string; description: string; sourceType: SourceType; sourceRef: string; sourceStatus: 'verified' | 'proposed'; match: Record<string, unknown>; exampleEvent: Record<string, unknown> }
export interface StudioAsset { id: string; label: string; kind: 'animation'; animation: string; color: string; durationMs: number }
export interface StudioProject { schemaVersion: 1; revision: string; gameId: 'blackjack'; dealers: {id: DealerId; label: string}[]; events: StudioEvent[]; triggers: StudioTrigger[]; lines: StudioLine[]; assets: StudioAsset[] }
export interface PathDescriptor { path: string; label: string; category: TriggerCategory; kind: 'enum' | 'boolean' | 'number' | 'string' | 'array'; values?: Scalar[]; min?: number; max?: number; operators: PredicateOperator[] }
export interface RuntimeCatalog { schemaVersion: 1; revision: string; sourceNote: string; triggerSources: {id: string; label: string; description: string; status: string}[]; events: (StudioEvent & {baselineVariantId: string; variants: {id: string; label: string; priority: number; when: {all: {path: string; op: PredicateOperator; value: Scalar | Scalar[]}[]}; assetId: string}[]})[]; assets: StudioAsset[] }
export const DEALER_IDS: readonly DealerId[];
export const SOURCE_TYPES: readonly SourceType[];
export const TRIGGER_CATEGORIES: readonly TriggerCategory[];
export const MAX_ALTERNATIVES: number;
export const allowedPathDescriptors: readonly PathDescriptor[];
export const ALLOWED_PATH_DESCRIPTORS: readonly PathDescriptor[];
export class StudioValidationError extends Error { errors: string[]; statusCode: number }
export function createSeedProject(): StudioProject;
export function isAssetCompatible(event: StudioEvent | undefined, asset: StudioAsset | undefined): boolean;
export function validateProject(project: unknown, options?: {allowIncompatibleAnimations?: boolean}): StudioProject;
export function buildRuntimeCatalog(project: StudioProject, dealerId: DealerId): RuntimeCatalog;
export function addVariant(project: StudioProject, dealerId: DealerId, eventId: string, label?: string): StudioProject;
export function removeVariant(project: StudioProject, dealerId: DealerId, eventId: string, variantId: string): StudioProject;
export function removeTrigger(project: StudioProject, triggerId: string): StudioProject;
export function renameEvent(project: StudioProject, eventId: string, label: string): StudioProject;
export function renameLine(project: StudioProject, dealerId: DealerId, eventId: string, label: string): StudioProject;
