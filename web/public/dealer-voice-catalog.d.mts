import type {DealerSpeechProfile} from './dealer-speech-profile.mjs';
export interface DealerVoiceDraft {provider:''|'cartesia'|'elevenlabs';voiceId:string;modelId:string;language:string;customSettings:boolean;stability:string;similarity:string;style:string;speakerBoost:string}
export const DEALER_VOICE_PRESETS:readonly Readonly<{id:string;label:string;provider:string;aliases:readonly string[]}>[];
export function dealerVoicePreset(id:string,language?:string):NonNullable<DealerSpeechProfile['voice']>;
export function dealerVoiceDraft(voice?:DealerSpeechProfile['voice']):DealerVoiceDraft;
export function dealerVoiceFromDraft(draft:DealerVoiceDraft):unknown;
export function matchingDealerVoicePreset(draft:DealerVoiceDraft):string|null;
export function suggestedDealerVoicePreset(dealer:{id:string;label?:string}):string|null;
