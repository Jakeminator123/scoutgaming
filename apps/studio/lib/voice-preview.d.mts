export interface VoiceSettings { key: string; mismatch: boolean; cacheDir: string; disabled?: boolean }
export interface VoicePhrase { id: string; label: string; text: string }
export interface VoiceStatus { configured: boolean; message: string; voiceName: string; modelId: string; maxTextLength: number; phrases: readonly VoicePhrase[] }
export interface VoiceResult { id: string; audioUrl: string; cached: boolean; text: string; voiceName: string; modelId: string; productionApproved: false; syncedVideo: null }
export interface VoiceOptions { settings?: VoiceSettings; fetchImpl?: typeof fetch; env?: Record<string, string | undefined> }
export const VOICE_PREVIEW: { voiceId: string; voiceName: string; modelId: string; outputFormat: string; maxTextLength: number; voiceSettings: Record<string, number | boolean> };
export const VOICE_PHRASES: readonly VoicePhrase[];
export function readVoiceSettings(options?: { env?: Record<string, string | undefined>; envFiles?: string[] }): VoiceSettings;
export function voicePreviewStatus(settings?: VoiceSettings): VoiceStatus;
export function voicePreviewText(body: unknown): string;
export function voicePreviewId(text: string): string;
export function generateVoicePreview(body: unknown, options?: VoiceOptions): Promise<VoiceResult>;
export function voicePreviewResponse(request: Request, id: string, options?: VoiceOptions): Promise<Response>;
export function voicePreviewEndpoint(request: Request, options?: VoiceOptions): Promise<Response>;
