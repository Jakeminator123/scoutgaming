// The existing TEXT fields carry provenance; no new session table or schema is
// needed. Freeze this epoch when BO authorizes the code, never at its callback.
export function backofficePlayerSource(stamp,authEpoch) {
  if(typeof stamp!=='string' || !/^[a-f0-9]{64}$/.test(stamp) || !Number.isSafeInteger(authEpoch) || authEpoch<0) throw Error('Invalid backoffice session source');
  return `bo:${authEpoch}:${stamp}`;
}
export function readBackofficePlayerSource(value) {
  const match=typeof value==='string' && /^bo:(0|[1-9][0-9]*):([a-f0-9]{64})$/.exec(value);
  const authEpoch=match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(authEpoch) ? {authEpoch,stamp:match[2]} : null;
}

// A verified N1 login may enter its own ordinary player account on the shared
// public origin. This is a read-only decision; only the one-use handoff mints it.
export async function currentBackofficeAccount(req,{identity,boSession,roles=['admin','superadmin']}) {
  const cookies=(req.headers.cookie??'').split(';').map(value=>value.trim()).filter(value=>value.startsWith('bo_jwt='));
  if(cookies.length!==1) return null;
  const claims=await boSession(req);
  if(!claims || claims.partner || claims.aud!=='backoffice' || !roles.includes(claims.role)
    || typeof claims.source_stamp!=='string' || !Number.isSafeInteger(claims.auth_epoch) || claims.auth_epoch<0
    || !Number.isFinite(claims.exp) || claims.exp<=Date.now()/1000) return null;
  const account=await identity.find(claims.sub);
  return account && account.stamp===claims.source_stamp ? {...account,authEpoch:claims.auth_epoch} : null;
}
export async function backofficePlayerHandoffRequired(req, {db,identity,boSession,publicUrl,boUrl,playerId}) {
  const game=new URL(publicUrl),bo=new URL(boUrl);
  if(game.origin!==bo.origin || req.headers.host!==game.host) return false;
  const account=await currentBackofficeAccount(req,{identity,boSession});
  if(!account) return false;
  if(!playerId) return true;
  const link=await db.prepare('SELECT player_id FROM craig_player_links WHERE craig_user_id=?').get(account.id);
  return link?.player_id!==playerId;
}
