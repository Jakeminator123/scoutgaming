import { handlePartnerAuth, rejectPartnerMethod } from '../../../../lib/partner-session.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const GET = handlePartnerAuth;
export const POST = handlePartnerAuth;
export const PUT = rejectPartnerMethod;
export const PATCH = rejectPartnerMethod;
export const DELETE = rejectPartnerMethod;
export const HEAD = rejectPartnerMethod;
export const OPTIONS = rejectPartnerMethod;
