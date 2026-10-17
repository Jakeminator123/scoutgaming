import type { MotionClip, MotionTarget, MotionTrack } from './motion-library.mjs';
export interface MotionPlayback { status: 'playing' | 'finished' | 'cancelled' | 'reduced-motion' | 'unsupported'; cancel(): void }
export function motionKeyframes(track: MotionTrack): Keyframe[];
export function playMotion(clip: MotionClip, targets: Partial<Record<MotionTarget, HTMLElement | null>>, options?: { durationMs?: number; reducedMotion?: boolean; onFinish?: () => void }): MotionPlayback;
