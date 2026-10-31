import {handleNativeLayerAssets} from '@/lib/layer-asset-api.mjs';

export const runtime = 'nodejs';

export async function GET(request: Request) { return handleNativeLayerAssets(request); }
export async function HEAD(request: Request) { return handleNativeLayerAssets(request); }
export async function POST(request: Request) { return handleNativeLayerAssets(request); }
