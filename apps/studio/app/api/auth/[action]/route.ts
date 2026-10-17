import { handleNativeAuthAction } from '@/lib/studio-native-runtime.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const POST = handleNativeAuthAction;
