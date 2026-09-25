import { idleAdviceResponse } from '@/lib/idle-advice-server.mjs';

export const runtime = 'nodejs';
export async function POST(request: Request) { return idleAdviceResponse(request); }
