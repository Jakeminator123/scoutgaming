export type DealerId = string;
export type SourceType = 'speak' | 'deal' | 'reveal' | 'settle' | 'turn' | 'idle' | 'transition';
export type TriggerCategory = 'deterministic' | 'social' | 'temperament';
export type PredicateOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'includes' | 'all_eq' | 'in' | 'exists';
export type Scalar = string | number | boolean | null;
export interface StudioTrigger { id: string; label: string; category: TriggerCategory; path: string; op: PredicateOperator; value: Scalar | Scalar[] }
export interface VariantSelection { rules: boolean; model: boolean; random: boolean }
export interface StudioVariant { id: string; label: string; priority: number; triggerIds: string[]; assetId: string; videoGenerationId: string | null; selection?: VariantSelection }
export interface StudioLine { dealerId: DealerId; eventId: string; label: string; baselineVariantId: string; variants: StudioVariant[] }
export interface StudioEvent { id: string; label: string; description: string; sourceType: SourceType; sourceRef: string; sourceStatus: 'verified' | 'proposed'; match: Record<string, unknown>; exampleEvent: Record<string, unknown> }
export interface StudioAsset { id: string; label: string; kind: 'animation'; animation: string; color: string; durationMs: number }
export interface IdleBaseVideo { videoId: string; weight: number; durationMs: number }
export interface IdleAutomaticPolicy { averageEveryMs: number; jitterMs: number; cooldownMs: number; maxPerMinute: number }
export interface IdleVariantPolicy { videoId: string; durationMs: number; use: 'manual' | 'automatic' | 'rules' | 'openclaw'; automatic: IdleAutomaticPolicy | null }
export interface IdlePolicy { schemaVersion: 1; familyId: string; base: IdleBaseVideo[]; variants: IdleVariantPolicy[] }
export interface MediaVariantPolicy { videoId: string; selection: VariantSelection; priority: number; triggerIds: string[]; frequencyPercent?: number }
export interface MediaFamilyPolicy { familyId: string; variants: MediaVariantPolicy[] }
export interface LegacyClipBinding { dealerId: DealerId; part: string; clipId: string }
export type OpenClawMode = 'off' | 'rules' | 'random' | 'shadow' | 'active';
export type LaneBackgroundMode = 'baked' | 'image' | 'video';
export type LaneProbeMode = 'off' | 'shadow' | 'active';
export type OperatorAdjustable = 'table.color' | 'table' | 'background' | 'dealer' | 'branding';
export interface LaneBackgroundLayer { enabled: boolean; mode: LaneBackgroundMode; default: string | null; allowed: string[]; zones?: string[] }
export interface LaneTableLayer { enabled: boolean; default: string | null; allowed: string[]; colors?: string[] }
export interface LaneDealerLayer { enabled: boolean; default: string; allowed: string[] }
export interface LaneProbe { mode: LaneProbeMode; model?: import('./probe-policy.mjs').ProbePolicy['model'] }
export interface LaneIdle { frequencyPercent?: number; variants?: string[] }
export interface LayerAsset { schemaVersion: 1; id: string; role: 'background' | 'table'; label: string; sha256: string; size: number; contentType: string; pathname: string; width: number; height: number }
export interface StudioLane { id: string; label: string; dealers: string[]; layers: { background: LaneBackgroundLayer; table: LaneTableLayer; dealer: LaneDealerLayer }; openclaw: { idle: OpenClawMode; deal: OpenClawMode; reveal: OpenClawMode; speak: OpenClawMode; probe: OpenClawMode }; operatorAdjustable: OperatorAdjustable[]; renderer?: 'layered' | 'portrait-video'; composition?: import('../../web/public/composition-settings.mjs').CompositionSettings; backgroundPlayback?: import('../../web/public/background-playback-policy.mjs').BackgroundPlaybackPolicy; probe?: LaneProbe; idle?: LaneIdle }
export interface DealerTrashEntry {deletion?:{state:'pending';requestedAt:string;mediaIds:string[]};schemaVersion:1|2; compositions?:StudioLane[]; legacyClipPolicy?:LegacyClipBinding[]; mediaPolicy?:MediaFamilyPolicy[]; globalIdlePolicy?:IdlePolicy; dealer:StudioProject['dealers'][number]; lines:StudioLine[]; idlePolicy:IdlePolicy|null; activeMediaIds:string[]; archivedAt:string}
export interface StudioProject {layerAssetTrash?: {asset:LayerAsset;archivedAt:string}[];dealerSets?:import('./dealer-sets.mjs').DealerSet[];dealerTrash?:DealerTrashEntry[];  schemaVersion: 1; revision: string; gameId: 'blackjack'; dealers: {id: DealerId; label: string; speechProfile?: import('../../web/public/dealer-speech-profile.mjs').DealerSpeechProfile}[]; events: StudioEvent[]; triggers: StudioTrigger[]; lines: StudioLine[]; assets: StudioAsset[]; idlePolicy?: IdlePolicy; dealerIdlePolicies?: {dealerId:DealerId;policy:IdlePolicy}[]; mediaPolicy?: MediaFamilyPolicy[]; legacyClipPolicy?: LegacyClipBinding[]; probePolicy?: import('./probe-policy.mjs').ProbePolicy; lanes?: StudioLane[]; layerAssets?: LayerAsset[]; clipLabels?: Record<string, string> }
export interface PathDescriptor { path: string; label: string; category: TriggerCategory; kind: 'enum' | 'boolean' | 'number' | 'string' | 'array'; values?: Scalar[]; min?: number; max?: number; operators: PredicateOperator[] }
export interface RuntimeCatalog { schemaVersion: 1; revision: string; sourceNote: string; triggerSources: {id: string; label: string; description: string; status: string}[]; events: (StudioEvent & {baselineVariantId: string; variants: {id: string; label: string; priority: number; when: {all: {path: string; op: PredicateOperator; value: Scalar | Scalar[]}[]}; assetId: string}[]})[]; assets: StudioAsset[] }
export const DEALER_IDS: readonly DealerId[];
export const SOURCE_TYPES: readonly SourceType[];
export const TRIGGER_CATEGORIES: readonly TriggerCategory[];
export const MAX_ALTERNATIVES: number;
export const LANE_ID: RegExp;
export const RESERVED_LANE_IDS: ReadonlySet<string>;
export const BACKGROUND_MODES: ReadonlySet<LaneBackgroundMode>;
export const LANE_PROBE_MODES: readonly LaneProbeMode[];
export const OPENCLAW_PHASES: readonly ['idle', 'deal', 'reveal', 'speak', 'probe'];
export const OPENCLAW_MODES: ReadonlySet<OpenClawMode>;
export const OPERATOR_ADJUSTABLE: readonly OperatorAdjustable[];
export const MAX_LANES: number;
export function validateLanes(lanes: unknown, dealerIds: ReadonlySet<string>): string[];
export const allowedPathDescriptors: readonly PathDescriptor[];
export const ALLOWED_PATH_DESCRIPTORS: readonly PathDescriptor[];
export class StudioValidationError extends Error { errors: string[]; statusCode: number }
export function defaultPresentationLane(dealerId: DealerId): StudioLane;
export function normalizeProject(project: unknown): StudioProject;
export function createEmptyProject(): StudioProject;
export function createSeedProject(): StudioProject;
export function isAssetCompatible(event: StudioEvent | undefined, asset: StudioAsset | undefined): boolean;
export function validateProject(project: unknown, options?: {allowIncompatibleAnimations?: boolean}): StudioProject;
export function buildRuntimeCatalog(project: StudioProject, dealerId: DealerId): RuntimeCatalog;
export function addVariant(project: StudioProject, dealerId: DealerId, eventId: string, label?: string): StudioProject;
export function removeVariant(project: StudioProject, dealerId: DealerId, eventId: string, variantId: string): StudioProject;
export function removeTrigger(project: StudioProject, triggerId: string): StudioProject;
export function renameEvent(project: StudioProject, eventId: string, label: string): StudioProject;
export function renameLine(project: StudioProject, dealerId: DealerId, eventId: string, label: string): StudioProject;

export function addDealer(project: StudioProject, id: string, label: string): StudioProject;
