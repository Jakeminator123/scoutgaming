import type {NativeStudioConfiguration} from './studio-native-runtime.mjs';
import type {NativeStudioSession} from '../../../packages/studio-access/studio-native-auth.mjs';
import type {createSpeechReplyLibrary} from '../../../packages/presentation/server/speech-reply-library.mjs';
export function createStudioRepliesApi(options:{replyLibrary:ReturnType<typeof createSpeechReplyLibrary>;authorize:(request:Request)=>Promise<NativeStudioSession>;config:NativeStudioConfiguration}):{handle(request:Request):Promise<Response>};
export function handleNativeStudioReplies(request:Request):Promise<Response>;
export function studioRepliesErrorResponse(error:unknown):Response;
