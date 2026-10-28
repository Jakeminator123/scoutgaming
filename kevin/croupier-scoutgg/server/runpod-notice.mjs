// Kevin 28 Oct ("Sync meddelandet när vi har runpod errors, så vi trackar runpodden"): the maintenance banner follows
// RunPod's state instead of a hand-set MAINTENANCE_NOTICE. It is shown while any of these holds, and hidden as soon as
// all are green again:
//  - an open lip-sync alert from RunPod (server/alerts.mjs): an order that fails (ENDPOINT_PAUSED, an error response,
//    no answer), a worker that never comes, a worker down or too slow, a callback error, lines falling back to the
//    still (that one only after ORDER_GRACE, a serverless worker takes a minute to come)
//  - the dealer at the table has no worker ready although one was ordered more than ORDER_GRACE ago
//  - the RunPod balance (GraphQL myself.clientBalance, every 5 min) is under RUNPOD_LOW_BALANCE_USD (10 $), as the
//    alert "lagt_saldo" (webhook like the others)
//  - MAINTENANCE_NOTICE=1 still forces it by hand (text from MAINTENANCE_TEXT)
// Tracking: every change is logged ("underhåll: meddelandet visas (…)" / "dolt"), /api/notice?dealer=<id> answers
// {text, reasons:[{typ, dealer, since, fel}], balance}, and /api/lipsync-status carries the same under "runpod".
// The client polls /api/notice every 30 s (public/maintenance-notice.js).
export const DEFAULT_TEXT = "We are currently doing maintenance work. The dealer may not speak for a while.";
const TYPES = new Set(['bestallning', 'session_uteblir', 'worker_nere', 'worker_for_langsam', 'callback_fel', 'stillbild', 'lagt_saldo']);
const GRACED = new Set(['stillbild']);

export function createRunpodNotice({ alerts, rorlig = () => null, rorligOn = () => false, apiKey = null, env = process.env, fetchImpl = globalThis.fetch,
  now = Date.now, log = console.log, pollMs = 300_000, orderGraceMs = 120_000 } = {}) {
  const lowUsd = Number(env.RUNPOD_LOW_BALANCE_USD ?? 10);
  const balance = { usd: null, at: null, fel: null };
  const lane = () => (typeof rorlig === 'function' ? rorlig() : rorlig);
  let shown = null;

  async function pollBalance() {
    if (!apiKey) return balance;
    try {
      const r = await fetchImpl('https://api.runpod.io/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ query: '{ myself { clientBalance } }' }), signal: AbortSignal.timeout(10_000) });
      const j = await r.json().catch(() => ({}));
      const usd = Number(j?.data?.myself?.clientBalance);
      if (!r.ok || !Number.isFinite(usd)) throw new Error(j?.errors?.[0]?.message ?? `HTTP ${r.status}`);
      Object.assign(balance, { usd, at: now(), fel: null });
      if (usd < lowUsd) alerts.fail('lagt_saldo', null, `RunPod-saldo ${usd.toFixed(2)} $ under ${lowUsd} $`);
      else alerts.ok('lagt_saldo', null);
    } catch (e) {
      Object.assign(balance, { at: now(), fel: String(e?.message ?? e).slice(0, 200) });
      log(`runpod-saldo: går inte att läsa (${balance.fel})`);
    }
    return balance;
  }

  function reasons(dealer = null) {
    const t = now(), out = [];
    if (env.MAINTENANCE_NOTICE === '1') out.push({ typ: 'manuell', dealer: null, since: null, fel: 'MAINTENANCE_NOTICE=1 i miljön' });
    for (const a of alerts.openList()) {
      if (!TYPES.has(a.typ) || (dealer && a.dealer && a.dealer !== dealer)) continue;
      if (GRACED.has(a.typ) && t - a.since < orderGraceMs) continue;
      out.push({ typ: a.typ, dealer: a.dealer, since: a.since, fel: a.fel });
    }
    const r = lane();
    if (dealer && r && rorligOn() && r.dealers.includes(dealer) && !r.ready(dealer) && !out.some(x => x.dealer === dealer)) {
      const asked = r.status()[dealer]?.asked;
      if (asked != null && asked * 1000 >= orderGraceMs) out.push({ typ: 'ingen_worker', dealer, since: t - asked * 1000, fel: `ingen läppsynksarbetare redo ${asked} s efter beställningen` });
    }
    return out;
  }
  const text = r => (r.length ? (env.MAINTENANCE_TEXT?.trim() || DEFAULT_TEXT).slice(0, 300) : '');
  function state(dealer = null) {
    const r = reasons(dealer);
    return { text: text(r), reasons: r, balance: { ...balance, low: lowUsd }, at: now() };
  }
  function track() {
    const key = reasons(null).map(x => `${x.typ}${x.dealer ? `(${x.dealer})` : ''}`).sort().join(' ');
    if (key === shown) return;
    log(key ? `underhåll: meddelandet visas (${key})` : (shown === null ? 'underhåll: meddelandet dolt (RunPod grönt)' : 'underhåll: meddelandet dolt igen (RunPod grönt)'));
    shown = key;
  }
  const timers = [];
  if (pollMs > 0) {
    timers.push(setInterval(() => { pollBalance().finally(track); }, pollMs), setInterval(track, 15_000));
    for (const t of timers) t.unref?.();
    pollBalance().finally(track);
  }
  return { state, text: dealer => state(dealer).text, reasons, pollBalance, track, stop() { for (const t of timers) clearInterval(t); } };
}
