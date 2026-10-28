// Kevin 23 Oct: "skapa en callback error med webhooks". Every failure in the lip sync or a worker's callback posts
// Slack-compatible JSON to ALERT_WEBHOOK_URL: {text, env, dealer, typ, tid, fel}. At most one alert per type and dealer
// per 10 min; once it works again (ok) one "återställt" message. Without the URL the alerts go to the log only.

const ICON = { fail: ':rotating_light:', ok: ':white_check_mark:' };

/** env: 'prod', 'staging' or 'local' (ALERT_ENV, else from the port the service listens on). */
export function alertEnv(e = process.env) {
  return e.ALERT_ENV ?? ({ 8620: 'prod', 8630: 'staging' }[e.PORT] ?? 'local');
}

export function createAlerts({ url = process.env.ALERT_WEBHOOK_URL, env = alertEnv(), fetchImpl = fetch, now = Date.now, log = console.log, windowMs = 600_000 } = {}) {
  const open = new Map();   // `${typ}:${dealer}` → { since, count, posted } while the failure lasts
  const posted = new Map(); // `${typ}:${dealer}` → when it was last posted: the 10 min hold outlives a recovery (a flapping worker)
  const post = body => {
    if (!url) return Promise.resolve(false);
    return fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) })
      .then(r => r.ok, e => { log(`larm: webhooken svarar inte (${e.message})`); return false; });
  };
  const who = dealer => (dealer ? ` (${dealer})` : '');
  return {
    /** A failure: logged every time; posted when it is new or the last post of it is 10 min old. → true when posted. */
    fail(typ, dealer, fel) {
      const key = `${typ}:${dealer ?? ''}`, o = open.get(key), t = now(), text = String(fel ?? '').slice(0, 300);
      log(`larm ${typ}${who(dealer)}: ${text}`);
      const due = t - (posted.get(key) ?? -Infinity) >= windowMs;
      if (o) { o.count++; o.fel = text; } else open.set(key, { since: t, count: 1, posted: false, typ, dealer: dealer ?? null, fel: text });
      if (!due) return false;
      posted.set(key, t); open.get(key).posted = true;
      post({ text: `${ICON.fail} ${env}: läppsynk ${typ}${who(dealer)}: ${text}`, env, dealer: dealer ?? null, typ, tid: new Date(t).toISOString(), fel: text });
      return true;
    },
    /** The failure is gone: one "återställt" message (logged and posted) if it was open. → true when it was. */
    ok(typ, dealer) {
      const key = `${typ}:${dealer ?? ''}`, o = open.get(key), t = now();
      if (!o) return false;
      open.delete(key);
      const mins = Math.max(1, Math.round((t - o.since) / 60000));
      log(`larm ${typ}${who(dealer)}: återställt efter ${mins} min (${o.count} fel)`);
      if (o.posted) post({ text: `${ICON.ok} ${env}: läppsynk ${typ}${who(dealer)}: återställt efter ${mins} min (${o.count} fel)`, env, dealer: dealer ?? null, typ, tid: new Date(t).toISOString(), fel: null, status: 'återställt' });
      return true;
    },
    open: () => [...open.keys()],
    /** The open failures with what they say (runpod-notice.mjs: the maintenance banner follows them). */
    openList: () => [...open.values()].map(o => ({ typ: o.typ, dealer: o.dealer, since: o.since, count: o.count, fel: o.fel })),
  };
}
