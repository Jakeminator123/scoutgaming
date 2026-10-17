// A Web reload starts a new native sequence and may select another local
// profile with its own table version. Keep its observations in a new channel
// so an earlier profile's version cannot suppress legitimate instructions.
export function scopeNativeSession(record, previousEpoch = 0) {
  const epoch = record.kind === 'status' && record.data?.state === 'attached'
    ? previousEpoch + 1 : previousEpoch;
  return { epoch, record: { ...record, channel: `native-session-${epoch}` } };
}
