// Read-only mapping candidates, per dealer, route and show.* event, for the lab.
// Read-only view over the same files the game reads: streams/index.json (engine clips),
// audio/en/bank.json (original speech), speech-media.json (native overrides),
// review/<dir>/speak.json (V2 speech), performance manifests and backoffice picks.
// Configuration, availability and declared hashes are not actual playback or visual approval.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveMediaAbsolutePath } from '../tools/media-layout.mjs';

const DEALERS = { vera: 'dealer', astrid: 'dealers/astrid', amira: 'dealers/amira', mei: 'dealers/mei' };
const PART_EVENT = { box0: 'show.deal.box0', box1: 'show.deal.box1', box2: 'show.deal.box2', box3: 'show.deal.box3', box4: 'show.deal.box4', box5: 'show.deal.box5', box6: 'show.deal.box6', 'dealer-up': 'show.deal.dealer', 'dealer-hole': 'show.deal.hole', return: 'show.return', idle: 'show.idle' };
const ACTION_EVENT = { 'deal-left': 'show.deal.left', 'deal-centre': 'show.deal.centre', 'deal-right': 'show.deal.right', 'deal-dealer': 'show.deal.dealer' };
const readJson = p => { try { return JSON.parse(readFileSync(resolveMediaAbsolutePath(p), 'utf8')); } catch { return null; } };

export function clipMapping({ root, bo = {}, publicUrl = '', revision = null }) {
  const dealers = {};
  const available = file => typeof file === 'string' && existsSync(resolveMediaAbsolutePath(join(root, file)));
  const native = readJson(join(root, 'speech-media.json')) ?? {};
  for (const [dealer, base] of Object.entries(DEALERS)) {
    const idx = readJson(join(root, base, 'streams/index.json')); if (!idx) continue;
    const bank = readJson(join(root, base, 'audio/en/bank.json')) ?? {};
    const entries = [];
    const originalRoute = `/?dealer=${dealer}`;
    for (const [key, c] of Object.entries(idx.clips ?? {})) {
      const short = key.split('/').pop();
      const kind = key.includes('/speak/') ? 'speech' : key.includes('/idle/') ? 'idle' : 'action';
      const event = kind === 'speech' ? `show.line.${short}` : kind === 'idle' ? 'show.idle' : key.includes('action-deal') ? 'show.deal.*' : key.includes('think') ? 'show.hand.think' : `show.gesture.${short}`;
      entries.push({ event, kind, line: kind === 'speech' ? short : null, text: bank[short]?.text ?? null, plays: kind === 'idle' ? 'loop' : 'once',
        file: `${base}/streams/${c.file}`, format: 'h264 annex-b elementary stream, WebCodecs, spliced on canonical pose', frames: c.frameCount, fps: c.fps, width: idx.width, height: idx.height,
        audio: kind === 'speech' && existsSync(resolveMediaAbsolutePath(join(root, base, 'audio/en', short + '.mp3'))) ? `${base}/audio/en/${short}.mp3` : null, audioDelayMs: c.audioDelayMs ?? null,
        preview: existsSync(resolveMediaAbsolutePath(join(root, base, 'preview', short + '.mp4'))) ? `${base}/preview/${short}.mp4` : null,
        route: originalRoute, candidate: true, actualPlayback: false, fileAvailable: available(`${base}/streams/${c.file}`),
        selector: 'CLIP map in app.mjs + DealerEngine; catalogue entry, not proof the current route selects it. Exact line id, never nearest duration.' });
    }
    const nativeSpeech = Object.entries(native[dealer] ?? {}).map(([line, take]) => ({
      event: `show.line.${line}`, kind: 'speech', line, text: take.text ?? null,
      file: take.src, fileAvailable: available(take.src), audio: null, audioSource: 'embedded', plays: 'once',
      route: originalRoute, candidate: true, actualPlayback: false, review: take.review ?? null,
      selector: 'speech-media.json exact line override in playRecorded; embedded audio/video clock. Staged packed variants may use actor provenance.',
    }));
    dealers[dealer] = { engine: entries, nativeSpeech };
  }
  // V2 speech is a distinct text/audio/video set, never relabel the original bank.
  for (const dealer of ['astrid', 'amira']) {
    const manifest = `review/${dealer}-green-speak/speak.json`;
    const speech = readJson(join(root, manifest));
    const greenSpeech = Object.entries(speech?.lines ?? {}).map(([line, take]) => ({
      event: `show.line.${line}`, kind: 'speech', line, text: take.text ?? null,
      file: take.media?.src, sha256: take.media?.sha256 ?? null, layout: take.media?.layout,
      frames: take.media?.frames, fps: take.media?.fps, width: take.media?.width, height: take.media?.height,
      audio: take.audio ?? null, audioSha256: take.audioSha256 ?? null,
      fileAvailable: available(take.media?.src), audioAvailable: available(take.audio),
      audioDelayMs: Number.isFinite(take.audioOffsetSeconds) ? take.audioOffsetSeconds * 1000 : null,
      cutIn: take.cutIn, cutOut: take.cutOut, plays: 'once', manifest,
      route: `/v2/?dealer=${dealer}`, enabled: speech.status === 'review' && speech.enabled !== false,
      status: speech.status ?? null, approval: speech.approval ?? null,
      candidate: true, actualPlayback: false,
      selector: 'astrid-green-speak.mjs exact line with its paired audio and manifest text; V2 route only, subject to runtime validation and loading.',
    }));
    dealers[dealer] = { ...dealers[dealer], greenSpeech };
  }
  // The current V2 keeps idle/speech, but filmed Astrid dealing is paused in app.mjs.
  const green = [];
  const dir = 'review/astrid-table-v2'; const list = readJson(join(root, dir, 'takes.json'));
  for (const f of list?.takes ?? []) { const t = readJson(join(root, dir, f)); if (!t) continue;
    green.push({ event: t.box != null ? `show.deal.box${t.box}` : ACTION_EVENT[t.action] ?? t.action, action: t.action, box: t.box ?? null, status: t.status, plays: 'once',
      file: t.media?.src, sha256: t.media?.sha256, layout: t.media?.layout, width: t.media?.width, height: t.media?.height, fps: t.media?.fps, frames: t.media?.frames,
      format: 'mp4, RGB over masks (R actor alpha, G fingers), composited by PerformancePlayer',
      selector: 'astrid-green-dealer.mjs selectGreenTake(action, box), currently bypassed by astridDealingPaused; shoe-to-felt card animation remains.',
      route: '/v2/?dealer=astrid', active: false, paused: true, actualPlayback: false, fileAvailable: available(t.media?.src) }); }
  const staged = []; const man = readJson(join(root, 'dealers/astrid/performance/manifest.json'));
  for (const t of [...(man?.takes ?? []), ...(man?.continuations ?? [])]) staged.push({ event: ACTION_EVENT[t.action] ?? t.action, action: t.action, id: t.id, status: t.status, continuation: t.continuation?.baseId ?? null, plays: 'once',
    file: t.media?.src, sha256: t.media?.sha256, layout: t.media?.layout, frames: t.media?.frames, fps: t.media?.fps, format: 'mp4 packed atlas',
    selector: 'performance-contact.mjs selectContactTake/selectPlayerDelivery by card x position; motion=rhythm or smooth60 loads a different manifest.',
    route: '/?dealer=astrid&performance=staged', candidate: true, actualPlayback: false, fileAvailable: available(t.media?.src) });
  dealers.astrid = { ...dealers.astrid, greenTakes: green, stagedTakes: staged, manifestStatus: man?.status ?? null };
  // backoffice picks (Dealing Clips) and never-again
  const picks = {};
  for (const [dealer, parts] of Object.entries(bo.clipAssignments ?? {})) {
    picks[dealer] = Object.fromEntries(Object.entries(parts).map(([part, assignment]) => {
      const idle = part === 'idle';
      const formerConsumer = !!DEALERS[dealer] && (idle || (dealer === 'astrid' && /^(box[0-6]|dealer-up|dealer-hole)$/.test(part)));
      return [PART_EVENT[part] ?? part, { clip: assignment.clip, at: assignment.at, part,
        consumed: false, active: false, excluded: !!bo.neverAgain?.[assignment.clip], actualPlayback: false,
        route: null, formerRoute: formerConsumer ? `/?dealer=${dealer}${idle ? '' : '&performance=staged'}` : null,
        condition: 'Preserved BO review data, inactive in ordinary gameplay. An exact registered dealer/situation may be explicitly imported to the saved Lab project; uncertain destinations and recorded speech are never borrowed.',
      }];
    }));
  }
  return { version: 2, generatedAt: new Date().toISOString(), revision, publicUrl, actualPlayback: false,
    notes: [
      'Cards, ranks and suits come from server-owned game data and use the route\'s DOM/3D presentation. Motion selection is independent of outcome; face-down dealer cards stay hidden until the server reveals them.',
      'This is a metadata snapshot of configured candidates, not a playback receipt, a file-integrity audit or visual/lip-sync approval. Declared hashes are copied from manifests, not recomputed.',
      'Original speech uses the original bank/engine or the exact native embedded-audio override. V2 greenSpeech has separate exact text, video, paired MP3 and delay; never substitute one route\'s caption for another.',
      'Engine clips are h264 elementary streams spliced on a canonical pose; performance/green takes are mp4 atlases composited over the table.',
      'Astrid V2 filmed dealing is paused. Original staged playback remains opt-in; base staged entries do not describe the alternative rhythm/smooth60 manifests.',
      'Active choices are edited in Backoffice/Lab and saved in project.json: mediaPolicy/idlePolicy for Astrid local presentation, legacyClipPolicy for the existing original engine/staged path. Historical BO picks remain read-only review data and are not runtime fallbacks. Never-again blocks exact legacy Lab bindings/imports, not every independent automatic selector.',
      'Landing annotations and want/no verdicts are human metadata, not measured card contact, acceptance or runtime promotion.'
    ],
    clipControl: { editor: 'Backoffice/Lab', source: 'lab/project.json', legacyBackofficeActive: false },
    events: { partsToEvents: PART_EVENT, actionsToEvents: ACTION_EVENT },
    backofficePicks: picks, neverAgain: Object.keys(bo.neverAgain ?? {}), verdicts: bo.genVerdicts ?? {},
    clipLandings: bo.clipLandings ?? {}, genLandings: bo.genLandings ?? {},
    dealers };
}
