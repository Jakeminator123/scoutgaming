import { socialEndpoint } from '@/lib/social-server.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vercel's public gateway sends this protected capability query to Render,
// which owns model/voice status and the speech session cookie.
export async function GET(request: Request) {return socialEndpoint(request);}
