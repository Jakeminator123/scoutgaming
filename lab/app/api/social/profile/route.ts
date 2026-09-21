import { socialEndpoint } from '@/lib/social-server.mjs';
export const runtime = 'nodejs';
export async function GET(request: Request) { return socialEndpoint(request); }
export async function POST(request: Request) { return socialEndpoint(request); }
