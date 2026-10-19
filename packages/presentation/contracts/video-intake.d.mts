import type { StudioEvent, StudioVariant, VariantSelection } from './studio-model.mjs';
export interface VideoMetadata { recordedSpeech?: import('./recorded-speech.mjs').RecordedSpeech; archived?: boolean; mediaType?: 'audio'|'image'; game?:'roulette'; action?:string; startPose?:'VILA'|'REDO'|'WHEEL'|'unverified'; endPose?:'VILA'|'REDO'|'WHEEL'|'unverified'; label: string; dealerId: string; eventId: string; kind: 'idle' | 'action' | 'speech' | 'reaction'; role: 'standard' | 'alternative'; situation: string; notes: string; playback?: 'once'; familyId?: string; compositing?: VideoCompositing; framing?: import('./dealer-framing.mjs').DealerFraming }
export type VideoCompositing = {mode: 'opaque'} | {mode:'alpha'} | {mode: 'green-screen'; threshold: number; softness: number; despill: number};
export function validateVideoCompositing(input: unknown): VideoCompositing;
export function videoCompositing(video?: {classification?: VideoMetadata}): VideoCompositing;
export const MAX_VIDEO_BYTES: number;
export const VIDEO_KINDS: Record<VideoMetadata['kind'], string>;
export const DEFAULT_SELECTION: Readonly<VariantSelection>;
export const MANUAL_SELECTION: Readonly<VariantSelection>;
export function selectionFor(variant: StudioVariant): VariantSelection;
export function kindForEvent(event: StudioEvent): VideoMetadata['kind'];
export function situationsForEvent(event: StudioEvent): string[];
export function validateVideoMetadata(input: unknown, options?: {allowLegacySituation?: boolean;forWrite?: boolean}): VideoMetadata;
export function validateClipPoses(input: Pick<VideoMetadata,'kind'|'eventId'|'situation'|'mediaType'|'startPose'|'endPose'>, event: StudioEvent): void;
export function videoFitsLine(video: {classification?: VideoMetadata} | undefined, dealerId: string, eventId: string): boolean;
export function videoFitsEvent(video: {classification?: VideoMetadata}, event: Record<string, unknown>): boolean;
