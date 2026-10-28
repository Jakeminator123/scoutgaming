// Presentation-only gate inspired by Kevin's result-after-cards behaviour.
// The controller already supplies the server-adjusted clock and redraws at
// plan.endAt and when presentation finishes. No DOM polling, extra timer,
// optimistic payout, or client-owned game clock belongs here.
export function sharedRoomResultPending({ snapshot, serverNow, presenting = false } = {}) {
  if (snapshot?.phase !== 'settled') return false;
  const at = serverNow ?? snapshot.serverNow, endAt = snapshot.plan?.endAt ?? 0;
  return presenting || !Number.isFinite(at) || !Number.isFinite(endAt) || at < endAt;
}
