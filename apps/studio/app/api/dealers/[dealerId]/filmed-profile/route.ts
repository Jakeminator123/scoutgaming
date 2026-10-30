import {nativeStudioAdminEnabled} from '@/lib/studio-native-runtime.mjs';
import {handleNativeStudioDealer} from '@/lib/studio-dealer-api.mjs';
export const runtime='nodejs';
// Admin › Dealers › Landningar: the dealer's own filmed profile (GET, PUT copy/measurement, DELETE).
const unavailable=()=>Response.json({error:'studio_cloud_lifecycle_required'},{status:503});
export async function GET(request:Request){return nativeStudioAdminEnabled()?handleNativeStudioDealer(request):unavailable();}
export async function PUT(request:Request){return nativeStudioAdminEnabled()?handleNativeStudioDealer(request):unavailable();}
export async function DELETE(request:Request){return nativeStudioAdminEnabled()?handleNativeStudioDealer(request):unavailable();}
