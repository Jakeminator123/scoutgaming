import {studioSpeechBuildEndpoint} from '@/lib/studio-speech-build-service.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(request:Request){return studioSpeechBuildEndpoint(request);}
export async function HEAD(request:Request){return studioSpeechBuildEndpoint(request);}
export async function POST(request:Request){return studioSpeechBuildEndpoint(request);}
