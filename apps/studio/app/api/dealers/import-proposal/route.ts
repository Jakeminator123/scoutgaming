import { handleNativeDealerImport } from '@/lib/dealers/dealer-import-api.mjs';

export const runtime = 'nodejs';
export const maxDuration = 75;

export async function GET(request: Request) { return handleNativeDealerImport(request); }
export async function POST(request: Request) { return handleNativeDealerImport(request); }
