// The PostgreSQL trigger is installed by product-schema.sql, never at runtime.
export function installBoAuthEpoch(db) {
  return async id => {
    const row = await db.prepare('SELECT epoch FROM bo_auth_epochs WHERE user_id=?').get(id);
    const epoch = Number(row?.epoch ?? 0);
    if (!Number.isSafeInteger(epoch) || epoch < 0) throw new Error('Invalid authentication epoch');
    return epoch;
  };
}
