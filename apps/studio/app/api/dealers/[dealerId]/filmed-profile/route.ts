import {handleNativeStudioDealer} from '@/lib/studio-dealer-api.mjs';

// Admin › Dealers › Landningar: the dealer's own filmed profile (GET, PUT copy/measurement, DELETE).
export const runtime='nodejs';

export async function GET(request: Request) { return handleNativeStudioDealer(request); }
export async function PUT(request: Request) { return handleNativeStudioDealer(request); }
export async function DELETE(request: Request) { return handleNativeStudioDealer(request); }
