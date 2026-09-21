export const SOCIAL_SPEECH_LIMIT_MS: 25000;
export interface SocialPlaybackResult { outcome: 'completed' | 'cancelled' | 'rejected' | 'failed'; reason: string; durationMs: number | null }
export interface SocialPlayback {
  play(source: string): Promise<SocialPlaybackResult>;
  cancel(reason?: string): void;
  readonly active: boolean;
}
export function createSocialPlayback(options?: {
  createAudio?: (source: string) => HTMLAudioElement;
  schedule?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
  onState?: (state: 'idle' | 'loading' | 'playing') => void;
  onActivity?: (result: SocialPlaybackResult) => void;
}): SocialPlayback;
