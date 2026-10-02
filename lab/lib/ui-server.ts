import { redirect } from 'next/navigation';
import { assertLocalPageRequest } from './http-guard.mjs';
import { studioInitialData } from './studio-server.mjs';
import { remoteUiConfiguration, authorizeRemoteUi, remoteUiInitialData } from './remote-ui.mjs';

function login(error: unknown, request: Request) {
  if ((error as {statusCode?: number})?.statusCode !== 401) throw error;
  const config = remoteUiConfiguration();
  const path = new URL(request.url).pathname;
  const next = path.startsWith('/studio') ? path : `/studio${path === '/' ? '' : path}`;
  redirect(`${config!.publicOrigin}/api/auth/lab/start?next=${encodeURIComponent(next)}`);
}

export async function authorizeUiPage(request: Request) {
  if (!remoteUiConfiguration()) { assertLocalPageRequest(request); return; }
  try { await authorizeRemoteUi(request); } catch (error) { login(error, request); }
}

export async function studioUiInitialData(request: Request) {
  if (!remoteUiConfiguration()) { assertLocalPageRequest(request); return studioInitialData(); }
  try { return await remoteUiInitialData(request); } catch (error) { return login(error, request); }
}
