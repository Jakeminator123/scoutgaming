import type { StudioProject, StudioLine, StudioVariant } from './studio-model.mjs';
export const SPEECH_SLOT_IDS: readonly string[];
export const OTHER_SPEECH_SLOT_IDS: readonly string[];
export interface SpeechSlot { dealerId: string; eventId: string; situation: string }
export function speechSlotEventId(situation: string): string;
export function speechSlotVariantId(dealerId: string, eventId: string, situation: string): string;
export function speechSlotSituation(line: StudioLine, variant: StudioVariant): string | null;
export function validateSpeechSlotLine(line: StudioLine): StudioLine;
export function speechSlotStandard(project: StudioProject, dealerId: string, eventId: string, situation: string): StudioVariant | null;
export function bindSpeechSlotStandard(project: StudioProject, slot: SpeechSlot & { videoId: string | null }): StudioProject;
export function speechSlotVideoFits(video: unknown, slot: SpeechSlot & { requireRecordedSpeech?: boolean }): boolean;
