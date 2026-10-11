export interface DealerSpeechProfile {schemaVersion:1|2;state:'preparation'|'enabled';voice:{provider:'cartesia'|'elevenlabs';voiceId:string;modelId:string;language?:string;settings?:{stability?:number;similarity_boost?:number;style?:number;use_speaker_boost?:boolean}}|null;reference:{kind:'video-frame'|'motion-video';videoId:string;sha256:string;offsetMs:number}|null}
export function normalizeDealerSpeechProfile(value:unknown):DealerSpeechProfile;
export function dealerSpeechPreparation(value:DealerSpeechProfile|undefined):{active:false;requested:boolean;missing:string[];message:string};
export function isSpeechReferenceVideo(video:any,dealerId:string):boolean;
export function validateDealerSpeechReference(profile:unknown,video:any,dealerId:string):void;
