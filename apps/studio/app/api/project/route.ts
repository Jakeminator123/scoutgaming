import { handleNativeStudioDocument } from '@/lib/studio-document-api.mjs';

export const runtime = 'nodejs';

export async function GET(request: Request) { return handleNativeStudioDocument(request); }
export async function PUT(request: Request) { return handleNativeStudioDocument(request); }
