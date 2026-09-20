import { socialEndpoint } from '@/lib/social-server.mjs';
export const runtime = 'nodejs';
export async function POST(request: Request) { return socialEndpoint(request); }
