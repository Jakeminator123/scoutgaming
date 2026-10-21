import type { IdlePolicy } from '../../../packages/presentation/runtime/idle-policy.mjs';

export interface LiveIdleInventory {
  families?: { id: string; dealerId: string; playbackType: string; standardIds: string[]; variantIds: string[] }[];
  videos: { id: string; available: boolean; familyId?: string; role?: 'standard' | 'variant' }[];
}
export interface LiveIdleScene { active: boolean; visible: boolean; actionBusy: boolean; speechReady: boolean; speechPlaying: boolean; identity: string; revision: string }
export interface LiveIdleClip {
  playId: number; kind: 'base' | 'variant' | 'server'; videoId: string;
  reason: 'weighted-base' | 'scheduled' | 'speech-ready' | 'base-resumed' | 'openclaw' | 'rules' | 'server-chain';
  ver?: number; startAt?: number; endAt?: number;
  requestId?: string;
  repeat: boolean; standardBase: boolean;
}
export interface LiveIdleSnapshot { clip: LiveIdleClip | null; idleReady: boolean; state: 'idle' | 'blocked' | 'unavailable' | 'closed' }
export interface LiveIdleController {
  snapshot(): LiveIdleSnapshot;
  updateScene(value: Partial<LiveIdleScene>): LiveIdleSnapshot;
  updatePolicy(policy: IdlePolicy, inventory: LiveIdleInventory): LiveIdleSnapshot;
  clearOffers(): LiveIdleSnapshot;
  offerVariant(value: { videoId: string; requestId: string; expiresAt: number }, options?: { use?: 'openclaw' | 'rules' }): boolean;
  started(playId: number): LiveIdleSnapshot;
  presented(playId: number): LiveIdleSnapshot;
  completed(playId: number): LiveIdleSnapshot;
  failed(playId: number): LiveIdleSnapshot;
  close(): LiveIdleSnapshot;
  /** Only in mode 'server-chain': follow the server-laid room chain entry. */
  follow?(entry: { ver: number; startAt: number; endAt: number; videoId: string }): boolean;
  mode?: 'server-chain';
}
export function createLiveIdleController(options: {
  policy: IdlePolicy; inventory: LiveIdleInventory; dealerId?: string; seed?: number; now?: () => number; initialScene?: Partial<LiveIdleScene>;
  mode?: 'own' | 'server-chain';
}): LiveIdleController;
