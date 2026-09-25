export type IdleVariantUse = 'manual' | 'automatic' | 'rules' | 'openclaw';
export interface IdleBaseVideo { videoId: string; weight: number; durationMs: number }
export interface IdleAutomaticPolicy { averageEveryMs: number; jitterMs: number; cooldownMs: number; maxPerMinute: number }
export interface IdleVariantPolicy { videoId: string; durationMs: number; use: IdleVariantUse; automatic: IdleAutomaticPolicy | null; description?: string }
export interface IdlePolicy { schemaVersion: 1; familyId: 'astrid/idle.ready/ready'; base: IdleBaseVideo[]; variants: IdleVariantPolicy[] }
export interface IdlePreviewSegment { kind: 'base' | 'variant'; videoId: string; startMs: number; endMs: number; reason: 'weighted-base' | 'scheduled' }
export function createDefaultIdlePolicy(): IdlePolicy;
export function validateIdlePolicy(value: unknown): IdlePolicy;
export function idleShareEstimate(policy: IdlePolicy): { shares: Record<string, number>; automaticShare: number; baseShare: number };
export function createIdlePreviewPlan(policy: IdlePolicy, options?: { seed?: number; durationMs?: number }): IdlePreviewSegment[];
