import type { StudioProject } from './studio-model.mjs';
import type { RegistryVideo } from './video-registry.mjs';
export interface StudioAudit { events: number; lines: {dealerId: string; eventId: string; label: string; standardVideo: string | null; standardAvailable: boolean; situation: string; alternatives: number; boundAlternatives: number}[]; variants: number; motionRecords: number; uniqueMotions: number; socialMotions: number; duplicateMotions: string[][]; videoRecords: number; uniqueVideoHashes: number; boundVideos: number; problems: string[] }
export function auditStudio(project: StudioProject, videos?: RegistryVideo[]): StudioAudit;
