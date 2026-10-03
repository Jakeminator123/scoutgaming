export type StudioVoiceIdentity = { audioSha256: string; videoSha256: string; previewSha256: string;
  textSha256: string; indexSha256: string; audioDelayMs: number };
export function studioVoiceIdentity(value: unknown): StudioVoiceIdentity | null;
export function voiceReviewMatches(record: unknown, identity: unknown): boolean;
export function createRegisteredVoiceLines(options?: { env?: Record<string, string | undefined>; repositoryRoot?: string }): () => Promise<{
  dealers: Array<{ dealer: string; name: string; lines: Array<{ key: string; text: string; clip: boolean; delay: number | null;
    audio: string | null; preview: string | null; identity: StudioVoiceIdentity | null; reviewable: boolean;
    source: string; productionApproved: false }> }>;
  source: string; automaticVisualApproval: false;
}>;
