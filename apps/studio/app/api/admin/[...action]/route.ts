import { handleNativeAdmin } from '@/lib/studio-native-runtime.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const GET = handleNativeAdmin;
export const POST = handleNativeAdmin;
export const DELETE = handleNativeAdmin;
