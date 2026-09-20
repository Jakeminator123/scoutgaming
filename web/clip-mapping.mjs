// What actually plays today, per dealer and show.* event, for the Eventstudio lab.
// Read-only view over the same files the game reads: streams/index.json (engine clips),
// audio/en/bank.json (speech lines), review/<dir>/takes.json (green takes on the default
// Astrid route), performance/manifest.json (staged takes), and the backoffice picks.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DEALERS = { vera: 'dealer', astrid: 'dealers/astrid', amira: 'dealers/amira', mei: 'dealers/mei' };
const PART_EVENT = { box0: 'show.deal.box0', box1: 'show.deal.box1', box2: 'show.deal.box2', box3: 'show.deal.box3', box4: 'show.deal.box4', box5: 'show.deal.box5', box6: 'show.deal.box6', 'dealer-up': 'show.deal.dealer', 'dealer-hole': 'show.deal.hole', return: 'show.return', idle: 'show.idle' };
const ACTION_EVENT = { 'deal-left': 'show.deal.left', 'deal-centre': 'show.deal.centre', 'deal-right': 'show.deal.right', 'deal-dealer': 'show.deal.dealer' };
const readJson = p => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

export function clipMapping({ root, bo, publicUrl = '', revision = null }) {
  const dealers = {};
  for (const [dealer, base] of Object.entries(DEALERS)) {
    const idx = readJson(join(root, base, 'streams/index.json')); if (!idx) continue;
    const bank = readJson(join(root, base, 'audio/en/bank.json')) ?? {};
    const entries = [];
    for (const [key, c] of Object.entries(idx.clips)) {
      const short = key.split('/').pop();
      const kind = key.includes('/speak/') ? 'speech' : key.includes('/idle/') ? 'idle' : 'action';
      const event = kind === 'speech' ? `show.line.${short}` : kind === 'idle' ? 'show.idle' : key.includes('action-deal') ? 'show.deal.*' : key.includes('think') ? 'show.hand.think' : `show.gesture.${short}`;
      entries.push({ event, kind, line: kind === 'speech' ? short : null, text: bank[short]?.text ?? null, plays: kind === 'idle' ? 'loop' : 'once',
        file: `${base}/streams/${c.file}`, format: 'h264 annex-b elementary stream, WebCodecs, spliced on canonical pose', frames: c.frameCount, fps: c.fps, width: idx.width, height: idx.height,
        audio: kind === 'speech' && existsSync(join(root, base, 'audio/en', short + '.mp3')) ? `${base}/audio/en/${short}.mp3` : null, audioDelayMs: c.audioDelayMs ?? null,
        preview: existsSync(join(root, base, 'preview', short + '.mp4')) ? `${base}/preview/${short}.mp4` : null, selector: 'CLIP map in app.mjs + DealerEngine (exact line id, never nearest duration)' });
    }
    dealers[dealer] = { engine: entries };
  }
  // Astrid: green takes on the default route (review/astrid-table-v2) and staged performance takes
  const green = [];
  const dir = 'review/astrid-table-v2'; const list = readJson(join(root, dir, 'takes.json'));
  for (const f of list?.takes ?? []) { const t = readJson(join(root, dir, f)); if (!t) continue;
    green.push({ event: t.box != null ? `show.deal.box${t.box}` : ACTION_EVENT[t.action] ?? t.action, action: t.action, box: t.box ?? null, status: t.status, plays: 'once',
      file: t.media?.src, sha256: t.media?.sha256, layout: t.media?.layout, width: t.media?.width, height: t.media?.height, fps: t.media?.fps, frames: t.media?.frames,
      format: 'mp4, RGB over masks (R actor alpha, G fingers), composited by PerformancePlayer', selector: 'astrid-green-dealer.mjs selectGreenTake(action, box); other boxes fall back to CSS/3D card motion', route: 'default for dealer=astrid' }); }
  const staged = []; const man = readJson(join(root, 'dealers/astrid/performance/manifest.json'));
  for (const t of [...(man?.takes ?? []), ...(man?.continuations ?? [])]) staged.push({ event: ACTION_EVENT[t.action] ?? t.action, action: t.action, id: t.id, status: t.status, continuation: t.continuation?.baseId ?? null, plays: 'once',
    file: t.media?.src, sha256: t.media?.sha256, layout: t.media?.layout, frames: t.media?.frames, fps: t.media?.fps, format: 'mp4 packed atlas', selector: 'performance-contact.mjs selectContactTake/selectPlayerDelivery by card x position', route: '?performance=staged only' });
  dealers.astrid = { ...dealers.astrid, greenTakes: green, stagedTakes: staged, manifestStatus: man?.status ?? null };
  // backoffice picks (Dealing Clips) and never-again
  const picks = {}; for (const [d, parts] of Object.entries(bo.clipAssignments ?? {})) picks[d] = Object.fromEntries(Object.entries(parts).map(([p, a]) => [PART_EVENT[p] ?? p, { clip: a.clip, at: a.at }]));
  const speechLines = Object.keys(dealers.astrid?.engine?.filter(e => e.kind === 'speech') ?? {}).length;
  return { generatedAt: new Date().toISOString(), revision, publicUrl,
    notes: [
      'Cards: rank and suit are drawn by the DOM from game data; a deal take carries the motion for one box, first or later card alike. Split hands reuse the box take. Face-down = dealer hole card (show.deal.hole), no dedicated take today, CSS flip.',
      'Speech: one take per line id, chosen by exact id, played over audio/en/<line>.mp3 with audioDelayMs. Idle loops; everything else plays once.',
      'Engine clips are h264 elementary streams spliced on a canonical pose; performance/green takes are mp4 atlases composited over the table.',
      'Backoffice picks (Dealing Clips) override per table part when set; never-again clips never play.'
    ],
    events: { partsToEvents: PART_EVENT, actionsToEvents: ACTION_EVENT },
    backofficePicks: picks, neverAgain: Object.keys(bo.neverAgain ?? {}), verdicts: bo.genVerdicts ?? {},
    dealers };
}
