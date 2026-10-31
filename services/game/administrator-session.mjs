// The current administrator session on the shared origin; read-only.
export async function currentAdministratorAccount(req,{identity,boSession,roles=['admin','superadmin']}) {
  const cookies=(req.headers.cookie??'').split(';').map(value=>value.trim()).filter(value=>value.startsWith('bo_jwt='));
  if(cookies.length!==1) return null;
  const claims=await boSession(req);
  if(!claims || claims.partner || claims.aud!=='backoffice' || !roles.includes(claims.role)
    || typeof claims.source_stamp!=='string' || !Number.isSafeInteger(claims.auth_epoch) || claims.auth_epoch<0
    || !Number.isFinite(claims.exp) || claims.exp<=Date.now()/1000) return null;
  const account=await identity.find(claims.sub);
  return account && account.stamp===claims.source_stamp ? {...account,authEpoch:claims.auth_epoch} : null;
}
