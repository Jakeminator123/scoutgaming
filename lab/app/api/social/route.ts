import { socialEndpoint } from '@/lib/social-server.mjs';
import { nativeStudioAdminEnabled } from '@/lib/studio-native-runtime.mjs';
import { handleNativeStudioDocument } from '@/lib/studio-document-api.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return nativeStudioAdminEnabled() ? handleNativeStudioDocument(request) : socialEndpoint(request); }
export async function PUT(request: Request) { return nativeStudioAdminEnabled() ? handleNativeStudioDocument(request) : socialEndpoint(request); }
