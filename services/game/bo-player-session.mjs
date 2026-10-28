// Player sessions issued by the retired BO handoff carry `bo:<epoch>:<stamp>`
// provenance. Nothing mints them any more; existing rows stay validated until
// they expire.
export function readBackofficePlayerSource(value) {
  const match=typeof value==='string' && /^bo:(0|[1-9][0-9]*):([a-f0-9]{64})$/.exec(value);
  const authEpoch=match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(authEpoch) ? {authEpoch,stamp:match[2]} : null;
}

// The current administrator session on the shared origin; read-only.
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
