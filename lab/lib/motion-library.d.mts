export type MotionTarget = 'actor' | 'face' | 'leftArm' | 'rightArm' | 'blush';
export interface MotionFrame { at: number; x?: number; y?: number; rotate?: number; opacity?: number }
export interface MotionTrack { target: MotionTarget; frames: MotionFrame[] }
export interface MotionClip { assetId: string; eventId: string; label: string; durationMs: number; tracks: MotionTrack[] }
export const MOTION_TARGETS: readonly MotionTarget[];
export const MOTION_INDEX: { schemaVersion: 1; rig: string; gameId: string; synthetic: true; eventFiles: string[]; clipCount: number };
export const MOTION_CLIPS: readonly MotionClip[];
export function validateMotionClip(clip: unknown): MotionClip;
export function getMotionClip(assetId: string | undefined): MotionClip | undefined;
