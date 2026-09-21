import { readFile, realpath, stat, open } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { StudioError } from './project-store.mjs';
import { assertLocalRequest, jsonResponse } from './http-guard.mjs';
import { originalMediaId, isOriginalMediaId } from './original-media.mjs';
import { SPEECH_LINES } from '../../web/public/speech-lines.mjs';

// Match the lab's existing server path resolution. A directory new URL(...,
// import.meta.url) would be treated as a webpack asset import by Next.
const LAB = path.basename(process.cwd()) === 'lab' ? process.cwd() : path.resolve(process.cwd(), 'lab');
const PUBLIC = path.resolve(LAB, '../web/public');
const RUNTIME = path.resolve(LAB, 'lib/original-media-runtime.mjs');
const ROOT = '/api/original-media';
const DEALERS = { astrid: 'dealers/astrid', vera: 'dealer', amira: 'dealers/amira', mei: 'dealers/mei' };
const MODULES = ['dealer-engine.mjs', 'actor-compositor.mjs', 'speech-playback.mjs', 'performance-player.mjs', 'performance-contact.mjs', 'card-art.mjs', 'dealer-reach.mjs', 'scene-join.mjs', 'vendor/three/three.module.js', 'vendor/three/three.core.min.js'];
const OTHER_LINES = ['placebets', 'dealerblackjack', 'blackjack', 'dealerbust', 'win', 'push', 'lose'];
const readJson = async relative => JSON.parse(await readFile(path.join(PUBLIC, relative), 'utf8'));
async function exists(relative) { try { return (await stat(path.join(PUBLIC, relative))).isFile(); } catch { return false; } }
function sourceEvent(line) { return ['goodluck', 'insurance', 'double'].includes(line) ? `speak.${line}` : OTHER_LINES.includes(line) ? 'speak.other' : null; }

async function inventory() {
  const entries = [], definitions = new Map(), files = new Set(MODULES);
  const nativeSpeech = await readJson('speech-media.json');
  for (const [dealerId, base] of Object.entries(DEALERS)) {
    const indexPath = `${base}/streams/index.json`, bankPath = `${base}/audio/en/bank.json`;
    const [index, bank] = await Promise.all([readJson(indexPath), readJson(bankPath)]);
    files.add(indexPath);
    files.add(`${base}/poster.jpg`);
    for (const [clipKey, clip] of Object.entries(index.clips)) {
      const idle = clipKey === 'idle-1/idle/idle';
      const line = clipKey.startsWith('idle-1/speak/') ? clipKey.slice('idle-1/speak/'.length) : null;
      // Old Astrid action is explicitly rejected. No indexed action is used as
      // a generic substitute for a filmed, calibrated card delivery.
      if (!idle && (!line || ['rules_decks', 'fair_rng'].includes(line))) continue;
      if (!/^[\w-]+\.h264$/.test(clip.file)) continue;
      const kind = idle ? 'idle' : 'speech', sourcePath = `${base}/streams/${clip.file}`;
      const audioPath = line ? `${base}/audio/en/${line}.mp3` : null;
      const native = line ? nativeSpeech[dealerId]?.[line] : null;
      const nativePath = typeof native?.src === 'string' && native.src.startsWith(`${base}/speech/`) && /^[\w/-]+\.mp4$/.test(native.src) ? native.src : null;
      const nativeAvailable = nativePath && await exists(nativePath);
      const sourceAvailable = await exists(sourcePath), audioAvailable = !audioPath || await exists(audioPath);
      const id = originalMediaId(dealerId, kind, line ?? 'ready');
      const entry = { id, label: `${dealerId[0].toUpperCase()}${dealerId.slice(1)} · ${line ?? 'idle'} · lokalt original`, dealerId,
        eventId: idle ? 'idle.ready' : sourceEvent(line), kind, situation: line ?? '',
        available: Boolean(nativeAvailable || sourceAvailable && audioAvailable), durationMs: Math.round(clip.frameCount / clip.fps * 1000),
        reviewStatus: 'unreviewed', previewUrl: `${ROOT}/player?id=${encodeURIComponent(id)}`,
        playbackKind: nativeAvailable ? 'native' : 'indexed', sourcePath: nativeAvailable ? nativePath : sourcePath,
        clipKey, audioDelayMs: clip.audioDelayMs ?? 0, caption: nativeAvailable ? native.text : (bank[line]?.text ?? SPEECH_LINES[line] ?? ''),
        note: 'Lokala originalbytes. Ingen ny visuell acceptans och inget kvitto på liveuppspelning.' };
      files.add(sourcePath); if (audioPath) files.add(audioPath); if (nativePath) files.add(nativePath);
      entries.push(entry); definitions.set(id, { ...entry, base, audioPath, frameCount: clip.frameCount, fps: clip.fps });
    }
  }
  const manifest = await readJson('dealers/astrid/performance/manifest.json');
  for (const take of manifest.takes ?? []) {
    if (take.dealer !== 'astrid' || take.status !== 'review' || !['deal-left', 'deal-centre', 'deal-right', 'deal-dealer'].includes(take.action)) continue;
    if (!/^dealers\/astrid\/performance\/[\w-]+\.mp4$/.test(take.media?.src)) continue;
    const destination = take.action.slice('deal-'.length), id = originalMediaId('astrid', 'action', destination);
    const entry = { id, label: `Astrid · ${take.action} · grundtagning`, dealerId: 'astrid', eventId: destination === 'dealer' ? 'deal.dealer' : `deal.player.${destination}`,
      kind: 'action', situation: destination, available: await exists(take.media.src), durationMs: Math.round((take.events.rest + 1) / take.media.fps / (take.playbackRate ?? 1) * 1000),
      reviewStatus: 'review', previewUrl: `${ROOT}/player?id=${encodeURIComponent(id)}`, playbackKind: 'packed', sourcePath: take.media.src,
      note: 'Staged-grundfilm under granskning. Originalets mask, kortkontakt och kalibrering; platsretargeting är ännu ofullständig.' };
    files.add(take.media.src); entries.push(entry); definitions.set(id, { ...entry, take });
  }
  return { entries, definitions, files };
}

export async function loadOriginalMediaCatalog() {
  const { entries } = await inventory();
  return { entries, notes: ['Originalförval gäller standardlinjer utan egen videokoppling och matchar alltid exakt replik.', 'Astrids avvisade gamla utdelning används aldrig. Reveal, tur, resultat och saknade filmer behåller 2D.', 'Grundfilmerna visar sina kalibrerade riktningar; individuell handkontakt för varje spelplats är inte färdig.'] };
}

async function fileResponse(file, request, type) {
  const handle = await open(file, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new StudioError('Originalfil saknas.', 404);
    const headers = { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes', 'Cross-Origin-Resource-Policy': 'same-origin' };
    let start = 0, end = info.size - 1, status = 200;
    const range = request.headers.get('range');
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) { await handle.close(); return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${info.size}` } }); }
      start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(info.size - 1, Number(match[2])) : info.size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) { await handle.close(); return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${info.size}` } }); }
      status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = String(end - start + 1);
    if (request.method === 'HEAD') { await handle.close(); return new Response(null, { status, headers }); }
    return new Response(Readable.toWeb(handle.createReadStream({ start, end, autoClose: true })), { status, headers });
  } catch (error) { await handle.close().catch(() => {}); throw error; }
}

export async function getOriginalMediaResponse(parts, request) {
  assertLocalRequest(request);
  if (parts.length === 1 && parts[0] === 'runtime.mjs') return fileResponse(RUNTIME, request, 'text/javascript; charset=utf-8');
  if (parts.length === 1 && parts[0] === 'player') {
    const id = new URL(request.url).searchParams.get('id');
    if (!isOriginalMediaId(id)) throw new StudioError('Okänt originalklipp.', 404);
    const { definitions } = await inventory();
    if (!definitions.has(id)) throw new StudioError('Okänt originalklipp.', 404);
    const posterPath = `${ROOT}/assets/${DEALERS[definitions.get(id).dealerId]}/poster.jpg`;
    const nonce = randomBytes(18).toString('base64');
    const html = `<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lokalt originalförval</title><style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;background:#171a19;color:#e8ede9;font:13px system-ui;overflow:hidden}#host{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,#4b4337,#141b19 75%)}#stream,#native{width:100%;height:100%;object-fit:contain;display:block}#caption{position:absolute;bottom:10px;left:8%;right:8%;padding:6px;background:#101511d9;text-align:center;border-radius:4px;pointer-events:none}#caption:empty{display:none}.performance-layer{position:absolute;pointer-events:none}.performance-layer canvas{width:100%;height:100%;display:block}#status{position:absolute;top:9px;left:10px;font-size:11px;color:#d6ddda}#enable-audio{position:absolute;top:8px;right:8px;background:#193b2c;color:white;border:1px solid #609277;border-radius:5px;padding:6px;cursor:pointer}</style><div id="host"><canvas id="stream"></canvas></div><div id="status">Lokalt original · ej visuellt godkänt</div><div id="caption"></div><button id="enable-audio" hidden>Slå på tal</button><script nonce="${nonce}" type="module" src="${ROOT}/runtime.mjs"></script></html>`;
    const withPoster = html.replace('<canvas id="stream">', `<img id="poster" alt="Dealerns stillbild · uppspelning startar med Spela" src="${posterPath}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain"><canvas id="stream">`);
    return new Response(request.method === 'HEAD' ? null : withPoster, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': `default-src 'none'; script-src 'self' 'nonce-${nonce}'; style-src 'nonce-${nonce}'; style-src-attr 'unsafe-inline'; media-src 'self' blob:; connect-src 'self'; img-src 'self' data: blob:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'`, 'Cross-Origin-Resource-Policy': 'same-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' } });
  }
  const inventoryData = await inventory();
  if (parts.length === 2 && parts[0] === 'definition') {
    const definition = inventoryData.definitions.get(parts[1]);
    if (!definition) throw new StudioError('Okänt originalklipp.', 404);
    return jsonResponse(definition);
  }
  if (parts[0] !== 'assets') throw new StudioError('Okänd originalresurs.', 404);
  const relative = parts.slice(1).join('/');
  if (!inventoryData.files.has(relative) || parts.some(part => part === '..' || part.includes('\\'))) throw new StudioError('Okänd originalresurs.', 404);
  let resolved;
  try { resolved = await realpath(path.join(PUBLIC, relative)); } catch { throw new StudioError('Originalfil saknas.', 404); }
  const publicReal = await realpath(PUBLIC), distance = path.relative(publicReal, resolved);
  if (distance.startsWith('..') || path.isAbsolute(distance)) throw new StudioError('Originalfilen ligger utanför mediebanken.', 403);
  const types = { '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.h264': 'application/octet-stream', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg' };
  return fileResponse(resolved, request, types[path.extname(relative)] ?? 'application/octet-stream');
}
