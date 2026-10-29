import type {VideoEntry} from './connected-studio.mjs';
import type {RoomReleasePreview} from './room-release.mjs';
export type AutoStepResult = {handled: true; [key: string]: unknown}|{handled: false; message: string; done?: string[]};
export const CHANGED_MESSAGE: string;
export function measureUnmeasured(input: {dealerId: string|null|undefined; clips?: VideoEntry[]|{videos: VideoEntry[]}|null; fetch?: typeof fetch; signal?: AbortSignal}): Promise<AutoStepResult>;
export function refreshStaleDraft(input: {operatorId: string; operatorSlug?: string; roomId?: string; revision: number; fetch?: typeof fetch; signal?: AbortSignal}): Promise<AutoStepResult>;
export function automaticBlocker(blocker: {code?: string; materialReason?: string; area?: string}|null|undefined): boolean;
export function resolveBlocker(input: {release: RoomReleasePreview|null|undefined; deps?: {fetch?: typeof fetch; signal?: AbortSignal; dealerId?: string|null;
  clips?: VideoEntry[]|null; operatorId?: string; operatorSlug?: string; revision?: number}}): Promise<AutoStepResult>;
