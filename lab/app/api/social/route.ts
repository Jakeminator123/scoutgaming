import { socialEndpoint } from '@/lib/social-server.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return socialEndpoint(request); }
export async function PUT(request: Request) { return socialEndpoint(request); }
