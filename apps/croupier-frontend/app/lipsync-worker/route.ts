import {handlePlatformWebSocket} from '../../lib/platform-websocket.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Pro + Fluid compute: retain Render's existing 540-second worker lease.
export const maxDuration = 600;
export async function GET(request: Request) {
  return handlePlatformWebSocket(request);
}
