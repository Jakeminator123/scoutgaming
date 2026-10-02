import {after} from 'next/server';
import {handlePlatformWebSocket} from '../../lib/platform-websocket.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET(request: Request) {
  return handlePlatformWebSocket(request, {retain: (promise: Promise<unknown>) => after(() => promise)});
}
