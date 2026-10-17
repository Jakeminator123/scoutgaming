import type {NativeStudioRuntime} from './studio-native-runtime.mjs';
export function createStudioSpeechBuildApi(runtime:NativeStudioRuntime,options?:{serviceLookup?:()=>any;verifyVoice?:(input:{signal:AbortSignal})=>Promise<{name:string;voiceId:string;verified:boolean}>;clock?:()=>number;secret?:Uint8Array}):{handle(request:Request):Promise<Response>};
export function studioSpeechBuildEndpoint(request:Request):Promise<Response>;
