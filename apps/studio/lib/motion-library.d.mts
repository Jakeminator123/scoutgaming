export type MotionTarget = 'actor' | 'face' | 'leftArm' | 'rightArm' | 'blush' | 'sadFace' | 'coverHands';
export interface MotionFrame { at: number; x?: number; y?: number; rotate?: number; opacity?: number }
export interface MotionTrack { target: MotionTarget; frames: MotionFrame[] }
export interface MotionClip { assetId: string; eventId?: string; scope?: 'social-lab'; reactionId?: string; label: string; durationMs: number; tracks: MotionTrack[] }
export const MOTION_TARGETS: readonly MotionTarget[];
export const MOTION_INDEX: { schemaVersion: 1; rig: string; gameId: string; synthetic: true; eventFiles: string[]; clipCount: number; socialFiles: string[]; socialClipCount: number };
export const MOTION_CLIPS: readonly MotionClip[];
export const SOCIAL_MOTION_CLIPS: readonly MotionClip[];
export function validateMotionClip(clip: unknown): MotionClip;
export function getMotionClip(assetId: string | undefined): MotionClip | undefined;
export function motionAllowedForSource(clip: MotionClip | undefined, sourceType: string): boolean;
export function stageBaseAnimation(event: { id: string; sourceType: string; exampleEvent: Record<string, unknown> }, requestedAnimation?: string): string;
