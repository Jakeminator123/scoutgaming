export interface DealerSpeechProfile {schemaVersion:1;state:'preparation';voice:{provider:'cartesia'|'elevenlabs';voiceId:string;modelId:string}|null;reference:{kind:'video-frame'|'motion-video';videoId:string;sha256:string;offsetMs:number}|null}
export function normalizeDealerSpeechProfile(value:unknown):DealerSpeechProfile;
export function dealerSpeechPreparation(value:DealerSpeechProfile|undefined):{active:false;missing:string[];message:string};
export function isSpeechReferenceVideo(video:any,dealerId:string):boolean;
export function validateDealerSpeechReference(profile:unknown,video:any,dealerId:string):void;
