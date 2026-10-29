import type {DealerSpeechProfile} from './dealer-speech-profile.mjs';
export type DealerVoice=NonNullable<DealerSpeechProfile['voice']>;
export interface DealerVoiceRequest {provider:'elevenlabs';voiceId:string;modelId?:string;language?:string;settings?:DealerVoice['settings']}
export interface DealerVoiceProfileView {source:'saved'|'catalog'|'none';name:string|null;provider:string|null;voiceId:string|null;modelId:string|null}
export const DEALER_VOICE_DEFAULT_MODEL:string;
export function validElevenLabsVoiceId(value:unknown):boolean;
export function validElevenLabsModelId(value:unknown):boolean;
export function dealerVoiceFromRequest(input:unknown,current?:DealerVoice|null):DealerVoice;
export function applyDealerVoiceProfile<T extends {dealers:{id:string;speechProfile?:unknown}[]}>(project:T,dealerId:string,voice:DealerVoiceRequest):T;
export function dealerVoiceProfileView(dealer:{id:string;label?:string;speechProfile?:unknown}|undefined):DealerVoiceProfileView;
