import { handlePartnerAuth, rejectPartnerMethod } from '../../../../lib/partner-session.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
// Next calls route handlers with (request, { params }). handlePartnerAuth's
// second parameter is the test-injected configuration, so the route must
// pass the request alone; otherwise the route context is taken for a
// configuration and every partner request fails with 503.
export const GET = (request: Request) => handlePartnerAuth(request);
export const POST = (request: Request) => handlePartnerAuth(request);
export const PUT = rejectPartnerMethod;
export const PATCH = rejectPartnerMethod;
export const DELETE = rejectPartnerMethod;
export const HEAD = rejectPartnerMethod;
export const OPTIONS = rejectPartnerMethod;
