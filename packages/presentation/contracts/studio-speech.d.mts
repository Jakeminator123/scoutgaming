import type {StudioProject} from '../../../packages/presentation/contracts/studio-model.mjs';
export type SpeechLanguage='sv'|'en';
export type SpeechLine={id:string;label:string;language:SpeechLanguage;exactText:string};
export const STUDIO_SPEECH_TEMPLATE_REVISION:string;
export const STUDIO_SPEECH_LINES:readonly {id:string;label:string;sv:string;en:string}[];
export function studioSpeechLineIds(game?:'blackjack'|'roulette'):string[];
export const STUDIO_ASTRID_VOICE:Readonly<{dealerId:'astrid';name:string;provider:'cartesia';voiceId:string;modelId:string;profileRevision:string;source:string}>;
export function studioSpeechLines(language:SpeechLanguage,ids?:string[]):SpeechLine[];
export function studioSpeechBuildCompatibility(project:StudioProject,dealerId:string):{supported:boolean;message:string};
export function applyStudioSpeechProfile(project:StudioProject,inventory:{videos:{id:string}[]},dealerId:string,input:unknown):StudioProject;
export function studioSpeechMediaUrl(value:unknown):string|null;
export type SpeechBuildPlan={token:string;dealerId:string;revision:string;templateRevision:string;language:SpeechLanguage;lines:SpeechLine[];voice:typeof STUDIO_ASTRID_VOICE&{verified:boolean};expiresAt:number;configured:boolean;message:string};
export type SpeechBuildResult={lineId:string;exactText:string;language:SpeechLanguage;state:'succeeded'|'failed';packageId?:string;audioUrl?:string;videoUrl?:string;audioSha256?:string;videoSha256?:string;textSha256?:string;frameCount?:number;fps?:number;audioDelayMs?:number;calibrationRevision?:string;reviewStatus?:'pending';error?:string};
export type SpeechBuildResponse={state:'prepared'|'succeeded'|'failed';plan?:SpeechBuildPlan;results?:SpeechBuildResult[];error?:string};

export interface StudioRecordedSpeech {id:string;label:string;situation:string;lineLabel:string;exactText:string;language:string;available:boolean;url:string|null;audio:boolean;contentType:string;sha256:string;speech:import('../../../packages/presentation/contracts/recorded-speech.mjs').RecordedSpeech|null;review:'missing-proof'|'invalid-proof'|'pending'|'rejected'|'approved'|'unavailable'}
export function studioRecordedSpeech(project:Pick<StudioProject,'clipLabels'>,inventory:{videos:{id:string;label:string;available:boolean;integrity:string;previewUrl:string;contentType?:string;sha256?:string;classification?:import('../../../packages/presentation/contracts/video-intake.mjs').VideoMetadata}[]},dealerId:string,game?:'blackjack'|'roulette'):StudioRecordedSpeech[];
