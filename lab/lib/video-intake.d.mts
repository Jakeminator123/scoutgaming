import type { StudioEvent, StudioVariant, VariantSelection } from './studio-model.mjs';
export interface VideoMetadata { label: string; dealerId: 'astrid' | 'vera' | 'amira' | 'mei'; eventId: string; kind: 'idle' | 'action' | 'speech' | 'reaction'; role: 'standard' | 'alternative'; situation: string; notes: string; playback?: 'once' }
export const MAX_VIDEO_BYTES: number;
export const VIDEO_KINDS: Record<VideoMetadata['kind'], string>;
export const DEFAULT_SELECTION: Readonly<VariantSelection>;
export const MANUAL_SELECTION: Readonly<VariantSelection>;
export function selectionFor(variant: StudioVariant): VariantSelection;
export function kindForEvent(event: StudioEvent): VideoMetadata['kind'];
export function situationsForEvent(event: StudioEvent): string[];
export function validateVideoMetadata(input: unknown, options?: {allowLegacySituation?: boolean}): VideoMetadata;
export function videoFitsLine(video: {classification?: VideoMetadata} | undefined, dealerId: string, eventId: string): boolean;
export function videoFitsEvent(video: {classification?: VideoMetadata}, event: Record<string, unknown>): boolean;
