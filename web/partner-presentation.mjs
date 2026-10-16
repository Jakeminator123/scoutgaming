// Headless presentation layer for the Partner API: tells a partner-built client
// WHAT to render (clip, land time, speech line) for each server event. The
// server decides the game; this only describes how our dealer presents it.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DEALERS = { astrid: { base: 'dealers/astrid', name: 'Astrid', room: 'Dark Hall', hands: 'dealers/astrid-hands' } };
// Seat geometry: 7 boxes on the table plane, viewer left→right, in 1920x1080 dealer-camera pixels. The measured source was staging at seven-targets/isolated-game-targets.json, removed from the tree; the file remains in Git history at 00ea55c5. Box centres are where the first card lands.
const BOX_CENTRES = { astrid: [[434.77, 693.12], [590.57, 742.89], [751.41, 774.96], [930.97, 783.72], [1144.64, 777.83], [1287.43, 763.51], [1431.24, 720.30]] };
const DEAL_ACTION = box => box == null ? 'deal-dealer' : box <= 1 ? 'deal-left' : box >= 5 ? 'deal-right' : 'deal-centre';

const j = (root, p) => { try { return JSON.parse(readFileSync(join(root, p), 'utf8')); } catch { return null; } };

export function buildAssetsManifest(root, dealerKey = 'astrid', publicUrl = '', {readMetadata,hasPublicMedia} = {}) {
  const d = DEALERS[dealerKey]; if (!d) throw Object.assign(new Error('unknown dealer'),{statusCode:400});
  const paths=[`${d.base}/streams/index.json`,`${d.hands}/streams/index.json`,`${d.base}/audio/en/bank.json`,`${d.base}/lipsync-overrides.json`,`${d.base}/performance/manifest.json`];
  const render=([index,hands,audio,delays,perf],previews)=>{
  const idx=index??{clips:{}},bank=audio??{},lipsync=delays??{};
  const url = p => `${publicUrl}/${p}`;
  const streams = Object.entries(idx.clips).map(([key, c]) => ({ key, kind: key.includes('/speak/') ? 'speech' : key.includes('/idle/') ? 'idle' : 'action',
    url: url(`${d.base}/streams/${c.file}`), codec: idx.codec, width: idx.width, height: idx.height, fps: c.fps, frames: c.frameCount, frameOffsets: url(`${d.base}/streams/index.json`) + '#' + key,
    handsMatte: hands?.clips?.[key] ? { url: url(`${d.hands}/streams/${hands.clips[key].file}`), width: hands.width, height: hands.height, note: 'grayscale h264; alpha for the bottom band so forearms render above the table art' } : null,
    audio: key.includes('/speak/') ? { url: url(`${d.base}/audio/en/${key.split('/').pop()}.mp3`), delayMs: lipsync[key.split('/').pop()] ?? 0, text: bank[key.split('/').pop()]?.text ?? null } : null,
    preview: previews.has(key) ? url(`${d.base}/preview/${key.split('/').pop()}.mp4`) : null }));
  const deals = (perf?.takes ?? []).filter(t => t.status !== 'rejected').map(t => ({ id: t.id, action: t.action, url: url(t.media.src), layout: t.media.layout, width: t.media.width, height: t.media.height, fps: t.media.fps, frames: t.media.frames,
    events: t.events, landAtMs: t.events?.land != null ? Math.round(t.events.land / t.media.fps * 1000) : null, camera: t.camera ? { shoeOutlet: t.camera.shoeOutlet, dealerRect: t.camera.registration?.dealerRect } : null }));
  return { version: 1, dealer: { key: dealerKey, name: d.name, room: d.room },
    scene: { room: url(`${d.base}/scene.png`), table: url(`${d.base}/table.png`), poster: url(`${d.base}/poster.jpg`), cardBack: url('assets/cardback.png'), shoe: url('assets/shoe.png'), chip: url('assets/chip-gold.png') },
    camera: { width: 1920, height: 1080, boxCentres: BOX_CENTRES[dealerKey] ?? null, note: 'Dealer-camera pixel space. Scale uniformly to your viewport; card at box N lands at boxCentres[N].' },
    cardArt: { note: 'Faces are drawn client-side: 184x264, radius 24, paper #f7f5ee, red suits #c22b2b, black #222, corner rank+suit at 48px, centre suit 80px. Or use your own art; only rank/suit are authoritative.' },
    streams, deals, speech: Object.keys(bank).map(k => ({ line: k, text: bank[k].text, audio: url(`${d.base}/audio/en/${k}.mp3`), lipsyncDelayMs: lipsync[k] ?? 0, clip: idx.clips[`idle-1/speak/${k}`] ? `idle-1/speak/${k}` : null })),
    formats: { h264: 'Raw Annex-B H.264 elementary stream (no container). Decode with WebCodecs VideoDecoder (codec in `codec`) or ffmpeg. `frameOffsets` in index.json gives [byteOffset,length] per frame for random access.', packedAtlas: 'rgb-over-masks: video frame stacked vertically as RGB tile, then mask tiles (R=actor alpha, G=fingers). Composite RGB over your table using the mask tile as alpha.' } };
  };
  if(readMetadata){
    return Promise.all(paths.map(path=>readMetadata(path))).then(async values=>{
      const previews=new Set();
      if(hasPublicMedia)await Promise.all(Object.keys(values[0]?.clips??{}).map(async key=>{if(await hasPublicMedia(`${d.base}/preview/${key.split('/').pop()}.mp4`))previews.add(key);}));
      return render(values,previews);
    });
  }
  const values=paths.map(path=>j(root,path));
  return render(values,new Set(Object.keys(values[0]?.clips??{}).filter(key=>existsSync(join(root,`${d.base}/preview/${key.split('/').pop()}.mp4`)))));
}

// Turn a table response into an ordered list of presentation events a client should play.
export function presentationEvents(prevView, view, op, extra = {}) {
  const ev = []; const r = view?.round; const pr = prevView?.round;
  const cardsOf = v => { const out = []; if (!v?.round) return out; v.round.hands?.forEach((h, hi) => h.cards?.forEach(c => out.push({ where: 'box', box: h.box, handIndex: hi, card: c }))); v.round.dealer?.forEach(c => out.push({ where: 'dealer', card: c })); return out; };
  const before = new Set(cardsOf(prevView).map(c => c.card.shoeDraw));
  // The dealer's hole card is dealt face down at start (present in the view without rank) and revealed at settle: emit `reveal`, not a second `deal`.
  const holeDraw = prevView?.round?.holeDraw ?? view?.round?.holeDraw ?? null, prevDealerHidden = holeDraw != null && !(prevView?.round?.dealer ?? []).some(c => c.shoeDraw === holeDraw);
  const fresh = cardsOf(view).filter(c => !before.has(c.card.shoeDraw) && !(c.where === 'dealer' && prevDealerHidden && c.card.shoeDraw === holeDraw)).sort((a, b) => a.card.shoeDraw - b.card.shoeDraw);
  if (op === 'start') ev.push({ type: 'speak', line: 'goodluck', blocking: true });
  const holeAtStart = op === 'start' && view?.round?.holeDraw != null ? { type: 'deal', to: 'dealer', box: null, handIndex: null, card: null, faceDown: true, shoeDraw: view.round.holeDraw, clip: { action: 'deal-dealer', prefer: 'astrid-dealer-*', fallback: 'slide' } } : null;
  const dealQueue = fresh.map(c => ({ c, draw: c.card.shoeDraw })); if (holeAtStart) dealQueue.push({ hole: holeAtStart, draw: holeAtStart.shoeDraw }); dealQueue.sort((a, b) => a.draw - b.draw);
  for (const item of dealQueue) { if (item.hole) { ev.push(item.hole); continue; } const c = item.c; const box = c.where === 'dealer' ? null : c.box; const action = DEAL_ACTION(box); ev.push({ type: 'deal', to: c.where, box, handIndex: c.handIndex ?? null, card: { r: c.card.r, s: c.card.s }, faceDown: c.card.r == null, shoeDraw: c.card.shoeDraw, clip: { action, prefer: `astrid-${action.replace('deal-', '')}-*`, fallback: 'slide' } }); }
  if (r?.phase === 'insurance' && pr?.phase !== 'insurance') ev.push({ type: 'speak', line: 'insurance' });
  if (op === 'act' && extra.action === 'double') ev.push({ type: 'speak', line: 'double' });
  if (r?.phase === 'settled' && pr?.phase !== 'settled') {
    // result = total returned (stake included). win: > stake, push: == stake, lose: 0 (or busted).
    const hands = (r.hands ?? []).filter(h => h.stake > 0);
    const val = cards => { let t = 0, aces = 0; for (const c of cards ?? []) { if (c.r == null) continue; if (c.r === 'A') { aces++; t += 11; } else t += ['K','Q','J'].includes(c.r) ? 10 : Number(c.r); } while (t > 21 && aces--) t -= 10; return t; };
    const dealerTotal = val(r.dealer); const dealerBJ = (r.dealer?.length === 2 && dealerTotal === 21);
    const outcome = h => h.busted || !(h.result > 0) ? 'lose' : h.result > h.stake ? (h.cards?.length === 2 && val(h.cards) === 21 && !h.split ? 'blackjack' : 'win') : 'push';
    const outs = hands.map(outcome); const anyWin = outs.some(o => o === 'win' || o === 'blackjack'), anyPush = outs.includes('push'), anyLose = outs.includes('lose');
    const line = dealerBJ ? 'dealerblackjack' : (outs.includes('blackjack') && anyWin) ? 'blackjack' : (dealerTotal > 21 && anyWin) ? 'dealerbust' : anyWin ? 'win' : (anyPush && !anyLose) ? 'push' : 'lose';
    const hole = r.dealer?.find(c => c.shoeDraw === holeDraw); if (prevDealerHidden && hole) ev.unshift({ type: 'reveal', to: 'dealer', card: { r: hole.r, s: hole.s }, shoeDraw: hole.shoeDraw });
    ev.push({ type: 'settle', dealerTotal, dealerBlackjack: dealerBJ, hands: hands.map((h, i) => ({ box: h.box, stake: h.stake, returned: h.result ?? 0, outcome: outs[i] })) }); ev.push({ type: 'speak', line });
  }
  if (r?.phase === 'decisions') ev.push({ type: 'turn', box: r.hands?.[r.active]?.box ?? null, handIndex: r.active, legalActions: r.legalActions ?? [] });
  if (r?.phase === 'insurance' && pr?.phase !== 'insurance') { /* speak already queued above */ }
  if (op === 'collect') ev.push({ type: 'speak', line: 'placebets' }, { type: 'idle' });
  return ev;
}
