import type { SourceType } from '../../packages/presentation/contracts/studio-model.mjs';
export type OutputKind = 'idle' | 'action' | 'speech' | 'reaction';
export interface PresentationProfile { id: OutputKind; label: string; symbol: string; summary: string; playback: string }
export interface EventField { path: string; label: string; note: string; optional: boolean; present: boolean; value: unknown }
export const OUTPUT_GROUPS: readonly Readonly<PresentationProfile>[];
export function presentationProfile(sourceType: SourceType | string): Readonly<PresentationProfile> | null;
export function describeEventFields(event: Record<string, unknown>): EventField[];
export function formatEventValue(value: unknown): string;
