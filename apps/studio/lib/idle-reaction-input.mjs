// A renderer reaction is not a new game instruction. Only a fresh user message
// from the currently bound native window can cause one advisory request.
export function idleReactionInput({ records, project, dealerId, mode, channel, revision, requestId, now = Date.now() }) {
  if (dealerId !== 'astrid' || !['active', 'shadow'].includes(mode) || typeof channel !== 'string'
    || !Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(records)
    || !project?.idlePolicy?.variants?.some(item => item.use === 'openclaw')) return null;
  let gap = -1;
  for (let index = 0; index < records.length; index++) {
    const item = records[index];
    if (['gap', 'conflict', 'limit'].includes(item.kind) || item.data?.gap === true) gap = index;
  }
  const prefix = `native:${channel}:`;
  const chats = records.slice(gap + 1).filter(item => item.source === 'native' && item.kind === 'chat'
    && typeof item.id === 'string' && item.id.startsWith(prefix)
    && ['user', 'assistant'].includes(item.data?.role) && typeof item.data.text === 'string' && item.data.text.trim()
    && Number.isFinite(Date.parse(item.time)));
  const latest = chats.findLast(item => item.data.role === 'user');
  if (!latest || now - Date.parse(latest.time) > 30000 || Date.parse(latest.time) > now) return null;
  let remaining = 3200;
  const messages = chats.filter(item => Date.parse(item.time) <= Date.parse(latest.time)).slice(-8).reverse().flatMap(item => {
    const text = item.data.text.slice(0, Math.min(600, remaining)); remaining -= text.length;
    return text ? [{ role: item.data.role, text, at: item.time }] : [];
  }).reverse();
  return { requestId, project, dealerId, mode,
    sourceRef: { kind: 'renderer-idle', channel, revision, messageId: latest.id, at: latest.time },
    observedChat: { source: 'native-observation', before: latest.time, messages } };
}
