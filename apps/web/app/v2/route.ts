import {platformUiDocument} from '../../lib/server-ui.mjs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return platformUiDocument(request); }
export async function HEAD(request: Request) { return platformUiDocument(request); }
