import { handlePartnerPreview, rejectPartnerPreviewMethod } from '../../../lib/partner-preview.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const GET = handlePartnerPreview;
export const POST = rejectPartnerPreviewMethod;
export const PUT = rejectPartnerPreviewMethod;
export const PATCH = rejectPartnerPreviewMethod;
export const DELETE = rejectPartnerPreviewMethod;
export const HEAD = rejectPartnerPreviewMethod;
export const OPTIONS = rejectPartnerPreviewMethod;
