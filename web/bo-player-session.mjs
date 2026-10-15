// A verified N1 login may enter its own ordinary player account on the shared
// public origin. This is a read-only decision; only the one-use handoff mints it.
export async function currentBackofficeAccount(req,{identity,boSession,roles=['admin','superadmin']}) {
  const cookies=(req.headers.cookie??'').split(';').map(value=>value.trim()).filter(value=>value.startsWith('bo_jwt='));
  if(cookies.length!==1) return null;
  const claims=await boSession(req);
  if(!claims || claims.partner || claims.aud!=='backoffice' || !roles.includes(claims.role)
    || typeof claims.source_stamp!=='string' || !Number.isFinite(claims.exp) || claims.exp<=Date.now()/1000) return null;
  const account=await identity.find(claims.sub);
  return account && account.stamp===claims.source_stamp ? account : null;
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
