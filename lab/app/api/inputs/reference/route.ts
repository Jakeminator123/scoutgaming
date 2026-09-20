import { partnerReferenceEndpoint } from '@/lib/partner-reference.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return partnerReferenceEndpoint(request); }
export async function POST(request: Request) { return partnerReferenceEndpoint(request); }
