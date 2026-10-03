import {platformUiDocument} from '../../lib/server-ui.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {return platformUiDocument(request);}
export function HEAD(request: Request) {return platformUiDocument(request);}
