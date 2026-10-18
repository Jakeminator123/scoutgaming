// Player-surface routes kept beside the game server so the request loop
// only has to call one function. Operator names are public. Profile is not.
import { handlePlayerProfile } from './player-profile.mjs';

function send(res, status, body) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store'});
  res.end(JSON.stringify(body));
}

export async function handlePlayerSurface(req, res, pathname, {db, playerId, guest = false, originOk = true, operators} = {}) {
  if (operators && await operators.handle(req, res, pathname)) return true;
  if (pathname !== '/api/profile') return false;
  if (guest) {
    send(res, 403, {error: 'profile_requires_account'});
    return true;
  }
  await handlePlayerProfile(req, res, {db, playerId, originOk: req.method === 'PATCH' ? originOk : true});
  return true;
}
