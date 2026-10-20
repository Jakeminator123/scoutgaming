// Which clip of a talk's idle chain the table shows now (shared-table.js idleChain, app.js next). Gapless: a clip is
// current from LEAD ms before its start until the next one's lead, so the handover on the previous clip's last frame
// (app.js, 1.5 frames before its end) lands on the next clip and never in a gap where a random idle would start.
// (20 Oct: with a 40 ms gap between clips the handover found nothing, dropped the prepared clip, started a random idle,
// and the interval that cuts random idles then kept killing the chain clip while it loaded.)
export const LEAD = 100;

/**
 * talks: state.talk; now: the table clock (ms); shiftOf(t): ms this viewer started the talk late (flexible answers), or
 * null when it has not started here yet. → {talk, clip, next, shift} or null.
 */
export function chainClipAt(talks, now, shiftOf = () => 0) {
  for (const t of talks ?? []) {
    if (!t.idle?.length) continue;
    const shift = shiftOf(t);
    if (shift === null || shift === undefined) continue;
    const at = now - shift;
    let i = -1;
    for (let k = 0; k < t.idle.length; k++) if (at >= t.idle[k].startAt - LEAD) i = k;
    if (i < 0 || at >= t.idle[i].endAt + 40) continue;
    return { talk: t, clip: t.idle[i], next: t.idle[i + 1] ?? null, shift };
  }
  return null;
}
