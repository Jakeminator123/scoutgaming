import { presentationDecisionResponse } from '@/lib/presentation-decision-http.mjs';
export const runtime = 'nodejs';
export async function POST(request: Request) { return presentationDecisionResponse(request); }
