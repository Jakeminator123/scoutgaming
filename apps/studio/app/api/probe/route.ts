import { probeEndpoint } from '@/lib/probe-server.mjs';
export const runtime='nodejs';
export async function GET(request:Request){return probeEndpoint(request);}
export async function POST(request:Request){return probeEndpoint(request);}
