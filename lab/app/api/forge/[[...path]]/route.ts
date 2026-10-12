import {nativeStudioAdminEnabled} from '@/lib/studio-native-runtime.mjs';
import {handleNativeDealerForge} from '@/lib/dealer-forge-api.mjs';
export const runtime='nodejs';
// Runway download + private Blob commit of a 1080p clip needs more than the default budget.
export const maxDuration=120;
const unavailable=()=>Response.json({error:'studio_cloud_lifecycle_required',message:'Dealer Forge kräver den molnbaserade Studio-körningen (CROUPIER_STUDIO_NATIVE_ADMIN=1).'},{status:503,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){return nativeStudioAdminEnabled()?handleNativeDealerForge(request):unavailable();}
export async function HEAD(request:Request){return nativeStudioAdminEnabled()?handleNativeDealerForge(request):unavailable();}
export async function POST(request:Request){return nativeStudioAdminEnabled()?handleNativeDealerForge(request):unavailable();}
