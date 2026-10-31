import {handleNativeDealerForge} from '@/lib/dealer-forge-api.mjs';

// Runway download + private Blob commit of a 1080p clip needs more than the default budget.
export const runtime='nodejs';
export const maxDuration=120;

export async function GET(request: Request) { return handleNativeDealerForge(request); }
export async function HEAD(request: Request) { return handleNativeDealerForge(request); }
export async function POST(request: Request) { return handleNativeDealerForge(request); }
