import { presentationDecisionResponse } from '@/lib/presentation-decision-http.mjs';
export const runtime = 'nodejs';
// Compatibility alias for existing callers; the same decision boundary applies.
export async function POST(request: Request) { return presentationDecisionResponse(request); }
