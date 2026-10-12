import {createPresentationReader} from './presentation.mjs';
// Astrid lipsync-demo 2.0 — delat bord där flera chattar med dealern samtidigt, plus ett API som kundens
// riktiga spel kan koppla in (se INTEGRATION.md).
//
//   webbsidan        public/ (startbild, idle-loop, svarsklipp, spelhändelser)
//   rummet           WebSocket på /            — chatt, svar och spelhändelser till alla vid bordet
//   API              /api/*                     — chat, speak, event, clips, health
//   GPU-arbetaren    WebSocket /lipsync-worker  — RunPod-arbetaren ringer upp hit (sessionsläge)
//
// Nycklarna i .env lämnar aldrig servern.

import { createServer } from "node:http";
import { createReadStream, statSync, readFileSync, mkdirSync } from "node:fs";
import { pipeline } from "node:stream";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { ROOT, loadEnv, need } from "./env.mjs";
import { createTableService } from "./table-service.mjs";
import { createSafetyAudit } from './safety-audit.mjs';
import { authorized,sameOrigin,createRateLimit,guestToken,clientAddress } from './request-safety.mjs';
import { RESPONSES,approvedSpeech,localResponse } from './dealer-policy.mjs';
import {localizeResponse,personalizedGreeting} from './dealer-responses-localized.mjs';
import {speechBank} from '../public/dealer-language.js';
import { factId, tableFact, roundResult } from './table-facts.mjs';
import { dealerTalk } from './dealer-chat.mjs';
import { createDealerMemory } from './dealer-memory.mjs';
import { draggeSay, draggeVoiceReady, draggeWarm, hasVoice, useLipsyncPod } from './dragge-voice.mjs';
import { createSharedTable, sessionName } from "./shared-table.mjs";
import { createStudioTables, LOGO_MAX } from "./studio-tables.mjs";
import { createBoSession } from "./bo-session.mjs";
import { createDemoGate } from "./demo-gate.mjs";
import { createStudioActivity, sidOf } from "./studio-activity.mjs";
import {createDealerGameTools,gameStateIntent,tableFactForVoice} from './dealer-game-tools.mjs';

import { auditAuthorized } from './audit-access.mjs';
import {OpenClaw} from './openclaw.mjs';
import {integrationIndex,eventEvidence} from './integration-index.mjs';
import { classifyManifest, mediaInventory } from './media-registry.mjs';

loadEnv();
const { ServerlessLipsync, sessionUrlFrom } = await import("./serverless.mjs");
const { PodLipsyncPool } = await import("./pod-lipsync.mjs");
const { Gemini } = await import("./llm.mjs");
const { CartesiaTTS, FREJA } = await import("./cartesia.mjs");
const { Astrid } = await import("./astrid.mjs");

const PORT = Number(process.env.PORT ?? 8600);
const PUBLIC = path.join(ROOT, "public");
const ANSWERS = path.join(ROOT, "answers");
const {manifest:MANIFEST,registry:MEDIA_REGISTRY} = classifyManifest(JSON.parse(readFileSync(path.join(PUBLIC, "media", "manifest.json"), "utf8")));
const AUDIT_TOKEN=process.env.GAME_AUDIT_TOKEN??'';
const mediaRegister=mediaInventory(PUBLIC,MEDIA_REGISTRY);
const readPresentation=createPresentationReader();
// Table Studio signs in with the back office accounts; only a signed-in BO user may create tables.
const bo=createBoSession();
const LOG_MAX = 40;
const NAMES = ["Guest", "Visitor", "Player", "Friend", "Newcomer", "Regular"];
const API_TOKEN = process.env.API_TOKEN ?? "";   // satt → POST /api/* kräver "Authorization: Bearer <token>"

mkdirSync(ANSWERS, { recursive: true });
mkdirSync(path.join(ROOT, "data"), { recursive: true });
const tableDb = process.env.TABLE_DB ?? path.join(ROOT, "data", "demo.sqlite");
// The dealers' memory of each visitor lives next to the table database.
// A studio slug never takes over a room people already play at (the public "astrid" room included).
const activity = createStudioActivity(path.join(path.dirname(tableDb), "studio-activity.sqlite"), tableDb);   // per sign-in: studio-activity.mjs
const studioTables = createStudioTables(path.join(path.dirname(tableDb), "studio-tables.json"), { reserved: slug => slug === "astrid" || shared.hasRoom(slug) });
const dealerMemory = createDealerMemory(path.join(path.dirname(tableDb), "dealer-memory.sqlite"));
const safetyAudit=createSafetyAudit(tableDb);
const chatLimit=createRateLimit();
const apiLimit=createRateLimit({limit:20});
const demoGate=createDemoGate(), demoLimit=createRateLimit({limit:10});   // Play demo password: see demo-gate.mjs
const localQA=process.env.RUNPOD_API_KEY==='local-qa-disabled';
// Take lengths of the ready dealers (built by croupier-dealer-dragge/build_ready_dealer.py); a studio table with one of them deals on his own timing.
const READY_TAKES=Object.fromEntries(['dragge','paow','marten'].map(id=>{try{return [id,{...JSON.parse(readFileSync(path.join(PUBLIC,'media','dealers',id,'v2','meta.json'),'utf8')),dir:`/media/dealers/${id}/v2/`}];}catch{return [id,null];}}));
const shared = createSharedTable(tableDb, {manifest:MANIFEST,onWelcome:welcomeGuest,limitsFor:room=>studioTables.limitsFor(room),languageFor:room=>studioTables.get(room)?.lang,readyFor:room=>READY_TAKES[studioTables.get(room)?.dealer??room]??null});
const dealerGameTools=createDealerGameTools(shared);
const table = createTableService(tableDb, {shared});
const tableTick = setInterval(()=>shared.tick(),250);
// Emil's dedicated pod: one engine per dealer, each dials /lipsync-worker?avatar=<id>. Astrid always uses it when the
// token is set; Dragge and Paow only when listed in LIPSYNC_POD_DEALERS (e.g. "dragge,paow"), else their RunPod endpoints.
const pod = process.env.LIPSYNC_POD_TOKEN ? new PodLipsyncPool({
  token: process.env.LIPSYNC_POD_TOKEN,
  name: process.env.LIPSYNC_POD_NAME ?? "mässpodden",
  log: (s) => console.log(s),
  onStatus: (text) => broadcast({ t: "status", text },null),
}) : null;
if (pod) useLipsyncPod(pod, (process.env.LIPSYNC_POD_DEALERS ?? "").split(",").map(s => s.trim()).filter(Boolean));
const lip = pod ? pod.for(process.env.LIPSYNC_POD_AVATAR ?? "astrid_spel2x") : new ServerlessLipsync({
  endpointId: need("RUNPOD_ENDPOINT_ID"),
  apiKey: need("RUNPOD_API_KEY"),
  sessionUrl: sessionUrlFrom(path.join(ROOT, "public-url.txt")),
  log: (s) => console.log(s),
  onStatus: (text) => broadcast({ t: "status", text },null),
  ordersFile: path.join(ANSWERS, ".sessioner.json"),
});
const tts = new CartesiaTTS({ key: need("CARTESIA_API_KEY"), voiceId: process.env.CARTESIA_VOICE ?? FREJA, log: (s) => console.log(s) });
const astrid = new Astrid({
  llm: process.env.DEALER_LLM_PROVIDER==='openclaw' ? new OpenClaw({url:need('OPENCLAW_PRODUCT_SPEECH_URL'),token:need('OPENCLAW_PRODUCT_SPEECH_TOKEN'),audit:r=>{safetyAudit.write(r);shared.recordSpeechDecision(r);}}) : new Gemini({ key: need("GEMINI_API_KEY"), model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite", audit:r=>safetyAudit.write(r) }),
  tts,
  lipsync: (pcm, rate) => lip.lipsync(pcm, rate),
  answersDir: ANSWERS,
});
astrid.onBusy = (on, queued) => broadcast({ t: "thinking", on, queued },null);

// ------------------------------------------------------------------ rummet ---
const clients = new Set();
const logs = new Map();
const roomAccess=new Map();
const roomLog=id=>{const time=Date.now();for(const [key,at] of roomAccess)if(time-at>1800000){logs.delete(key);roomAccess.delete(key);}if(!logs.has(id)){if(logs.size>=1000){const oldest=roomAccess.keys().next().value;logs.delete(oldest);roomAccess.delete(oldest);}logs.set(id,[]);}roomAccess.set(id,time);return logs.get(id);};
let seq = 0;

const send = (ws, o) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(o)); };
function broadcast(o, session = "astrid") { for (const c of clients) if(session == null || c.session===session)send(c, o); }
function remember(e,session="astrid") { const log=roomLog(session);log.push(e); while (log.length > LOG_MAX) log.shift(); }

/** Shared chat reply; clients reveal its text when the matching voice clip starts. */
function chat(who, text, session="astrid", guestToken=null) {
  const lang=shared.presentationContext(session).language;
  const policy=localResponse(text);
  if(policy==='privacy'){
    const reply=localizeResponse(RESPONSES.privacy,lang);
    broadcast({t:'notice',text:reply},session);
    safetyAudit.write({event:'chat_blocked',decision:'personal_data'});
    return Promise.resolve({text:reply,lang});
  }
  remember({ who, text },session);
  broadcast({ t: "said", who, text },session);
  if(!localQA)lip.notifyActivity("chattmeddelande");
  const id = `r${randomId()}`;
  const intent=policy==='support'?null:gameStateIntent(text);
  let job;
  if(intent) {
    const context=shared.presentationContext(session);
    const game=dealerGameTools.read_public_game_state({session,guestToken,playerName:who});
    shared.recordSpeechDecision({...context,decision:'tool_call',responseId:'read_public_game_state',requestId:id});
    job={kind:'game-fact',lang,gameFact:dealerGameTools.makeReply(intent,game,lang)};
  } else {
    job={kind:'chat',text,lang,getContext:()=>shared.presentationContext(session)};
  }
  return astrid.enqueue({
    ...job,
    onText: (reply) => broadcast({ t: "reply", id, to: who, text: reply },session),
  }).then((r) => {
    if(r.silent)return r;
    remember({ who: "astrid", text: r.text, url: r.url, ms: r.ms },session);
    broadcast({ t: "answer", id, to: who, ...r },session);
    return r;
  }, (e) => { broadcast({ t: "error", id, text: "The voice connection is unavailable. Please try again." },session); throw e; });
}

/** Dragge or Paow, a viewer's alternative dealer: exact table facts (hand, last round, turn, shoe,
 *  balance) or an in-character reply through the Scout subscription agent, guarded, with his memory
 *  of the visitor. Text and his lip-synced voice arrive together; the clip only plays for viewers
 *  who chose him. Anything about the asker's own game goes to the asker only (it can hold a balance). */
const VOICE_WAIT_MS = 12000;
async function talkReply(ws, text, dealer) {
  const language=shared.language(ws.session), id=`r${Date.now().toString(36)}`;
  broadcast({ t: "said", who: ws.name, text },ws.session);
  remember({ who: ws.name, text },ws.session);
  send(ws,{t:'thinking',on:true,queued:0});
  // Memory only per visitor cookie (Svenska Spel rehearsal 12 Oct): keyed by IP, everyone in one office shared it, names included.
  const view=shared.snapshot(ws.session, ws.guest), visitor=ws.guest?dealerMemory.key(ws.guest):null, fid=factId(text);
  let reply, talk=null;
  if(fid)reply=tableFact(fid,view,language);
  else {
    const past=visitor?dealerMemory.recall(visitor,dealer):{known:false,text:'You have never met this player before.',lines:[]};
    const facts=[tableFact('hand',view,'en'),tableFact('last',view,'en')].join(' ');
    talk=await dealerTalk({text,dealer,language,facts,history:past.lines,memory:past.text,playerName:view.me?.name??ws.name}).catch(()=>null);
    reply=talk?.text??localizeResponse(RESPONSES[localResponse(text)??'social'],language);
    if(talk&&visitor)dealerMemory.remember(visitor,dealer,{name:view.me?.name??ws.name,said:text,reply,note:talk.note});
  }
  remember({ who: "astrid", text: reply },ws.session);
  const out=m=>fid?send(ws,m):broadcast(m,ws.session);
  // His lip-synced voice when it is ready in time; a cold GPU never keeps the player waiting for the words.
  const clip=hasVoice(dealer)&&draggeVoiceReady(dealer)&&(fid||talk)?draggeSay(reply,language,ANSWERS,{dealer}).catch(()=>null):null;   // Dragge and Paow speak; Astrid keeps her pipeline
  const voiced=clip?await Promise.race([clip,new Promise(r=>setTimeout(()=>r(null),VOICE_WAIT_MS))]):null;
  out({t:'answer',id,to:ws.name,text:reply,dealer,...(voiced?{url:voiced.url}:{})});
  send(ws,{t:'thinking',on:false,queued:0});
}

/** Serhiy: a visitor on two boxes who lost one and won or pushed the other heard only the table's
 *  one outcome clip. When the client sees its round settle it asks for this; the line is built
 *  from that visitor's own settlement (never client text), only when the results are mixed, and
 *  comes in a lip-synced clip of the dealer the visitor watches, to that visitor only. Once per
 *  round per connection. */
async function roundResultReply(ws, roundId, dealer) {
  if (typeof roundId !== 'string' || ws.resultFor === roundId) return;
  const language = shared.language(ws.session);
  const text = roundResult(shared.snapshot(ws.session, ws.guest), roundId, language);
  if (!text) return;
  ws.resultFor = roundId;
  const id = `x${Date.now().toString(36)}`;
  const alt = ['dragge', 'paow', 'marten'].includes(dealer) ? dealer : null;
  let voiced = null;
  if (localQA) voiced = null;
  else if (alt) voiced = hasVoice(alt) && draggeVoiceReady(alt) ? await Promise.race([draggeSay(text, language, ANSWERS, { dealer: alt }).catch(() => null), new Promise(r => setTimeout(() => r(null), VOICE_WAIT_MS))]) : null;
  else voiced = await astrid.enqueue({ kind: 'game-fact', lang: language, gameFact: tableFactForVoice(text, language) }).catch(() => null);
  send(ws, { t: 'answer', id, to: ws.name, text, ...(alt ? { dealer: alt } : {}), ...(voiced?.url ? { url: voiced.url, ...(voiced.dur ? { dur: voiced.dur } : {}) } : {}) });
}

/** Exakt text (ingen LLM) — t.ex. dynamiska spelrepliker från kundens spel. */
function speak(text) {
  if(!approvedSpeech(text))throw new Error('Speech must use a reviewed response');
  if(!localQA)lip.notifyActivity('speak');
  const id = `s${Date.now().toString(36)}`;
  return astrid.enqueue({ kind: "speak", text, lang:shared.presentationContext('astrid').language }).then((r) => {
    broadcast({ t: "answer", id, to: null, ...r, spoken: true });
    return r;
  });
}

/** Förproducerat klipp (replik eller utdelning) till alla vid bordet. */
const lastVariant = new Map();   // händelse → senast spelade variant (samma två gånger i rad låter inspelat)

/** Händelse ("blackjack") → slumpad variant, aldrig samma som förra gången; exakt id ("blackjack_2") → den. */
function pickVariant(id) {
  const v = MANIFEST.handelser?.[id]?.varianter;
  if (!v?.length) return id;
  const pool = v.length > 1 ? v.filter((x) => x !== lastVariant.get(id)) : v;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  lastVariant.set(id, pick);
  return pick;
}

function event(requested,session="astrid") {
  const id = pickVariant(requested);
  const language=shared.presentationContext(session).language;
  const line = speechBank(MANIFEST,language).find((l) => l.id === id);
  const deal = MANIFEST.deal.find((d) => d.id === id);
  const clip = line ?? deal;
  if (!clip) return null;
  const msg = { t: "play", id, event: line?.event ?? id, url: clip.url, text: line?.text ?? null, sound: Boolean(line), dur: clip.dur, kort: deal?.kort ?? null };
  broadcast(msg,session);
  return msg;
}

async function welcomeGuest({session,name}) {
  const lang=shared.presentationContext(session).language,text=personalizedGreeting(name,lang),id=`g${randomId()}`;
  if(localQA){broadcast({t:'notice',text},session);return;}
  try {
    const result=await astrid.enqueue({kind:'greeting',name,lang});
    remember({who:'astrid',text:result.text,url:result.url,ms:result.ms},session);
    broadcast({t:'answer',id,to:name,...result,spoken:true},session);
  } catch {
    broadcast({t:'notice',text},session);
  }
}

function randomId(){return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}

// ------------------------------------------------------------------ http ---
const TYPES = { ".mp3": "audio/mpeg", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

/**
 * Fil med Range-stöd som ALLTID släpper sitt filhandtag (lärdomar från jep-live-blackjack):
 * utan Range spelar iOS Safari inte video alls; utan pipeline tar filhandtagen slut (EMFILE) när
 * mobiler avbryter range-förfrågningar, och processen dör.
 */
function sendFile(req, res, file) {
  let stat;
  try { stat = statSync(file); if (!stat.isFile()) throw 0; } catch { res.writeHead(404).end("inte hittad"); return; }
  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const immutable = /\.(mp4|png|jpg)$/.test(file);
  const base = {
    "Content-Type": type, "Accept-Ranges": "bytes",
    "Cache-Control": file.startsWith(ANSWERS+path.sep)?"private, no-store":immutable ? "public, max-age=86400" : "no-cache",
    "ETag": `"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`,
  };
  if (!req.headers.range && req.headers["if-none-match"] === base.ETag) { res.writeHead(304, base).end(); return; }
  const m = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (m) {
    const start = m[1] ? Number(m[1]) : 0;
    const end = m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
    if (start >= stat.size) { res.writeHead(416, { "Content-Range": `bytes */${stat.size}` }).end(); return; }
    res.writeHead(206, { ...base, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": end - start + 1 });
    return pump(res, createReadStream(file, { start, end }), file);
  }
  res.writeHead(200, { ...base, "Content-Length": stat.size });
  pump(res, createReadStream(file), file);
}

function pump(res, read, file) {
  pipeline(read, res, (err) => {
    if (!err) return;
    if (!["ERR_STREAM_PREMATURE_CLOSE", "ECONNRESET", "EPIPE"].includes(err.code)) console.error("filfel:", err.code, path.basename(file));
    read.destroy();
    if (!res.headersSent) res.writeHead(503).end(); else res.destroy();
  });
}

/** Sökväg under en rot, eller null (ingen ../). */
function inside(root, rel) {
  const p = path.normalize(path.join(root, decodeURIComponent(rel)));
  return p.startsWith(root + path.sep) ? p : null;
}

const json = (res, code, o) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control":"no-store" });
  res.end(JSON.stringify(o));
};

function body(req, limit = 20000) {
  return new Promise((ok, bad) => {
    let s = "", size=0, tooBig=false;
    req.on("data", (d) => { if(tooBig)return;size+=d.length;if(size>limit){tooBig=true;s="";bad(new Error("Request too large"));return;}s+=d; });
    req.on("end", () => { try { ok(s ? JSON.parse(s) : {}); } catch { bad(new Error("ogiltig JSON")); } });
  });
}

async function api(req, res, route) {
  if(req.headers.origin&&!sameOrigin(req))return json(res,403,{error:'Invalid origin'});
  if(req.method==='OPTIONS')return json(res,405,{error:'Cross-origin integration is disabled'});
  if(route.startsWith('backoffice/'))return json(res,410,{error:'Use the existing backoffice at https://croupier.scoutgg.dev/bo/'});
  if(route.startsWith('internal/game-audit')){
    if(!auditAuthorized(req,AUDIT_TOKEN))return json(res,401,{error:'Internal service authorization required'});
    if(req.method!=='GET')return json(res,405,{error:'Use GET'});
    const query=new URL(req.url,'http://localhost').searchParams;
    if(route==='internal/game-audit/integration'){
      try{return json(res,200,{index:integrationIndex(mediaRegister),events:eventEvidence(shared.backoffice({room:sessionName(query.get('room')??'astrid')}))});}
      catch{return json(res,400,{error:'Invalid integration query'});}
    }
    if(route==='internal/game-audit/media'){
      const asset=mediaRegister.find(m=>m.url===query.get('path')&&m.available);
      if(!asset)return json(res,404,{error:'Registered media not found'});
      res.setHeader('Cache-Control','private, no-store');
      return sendFile(req,res,path.join(PUBLIC,asset.url));
    }
    if(route!=='internal/game-audit')return json(res,404,{error:'Not found'});
    try{return json(res,200,{...shared.backoffice({room:sessionName(query.get('room')??'astrid'),before:query.get('before'),shoeId:query.get('shoeId'),view:query.get('view'),from:query.get('from'),to:query.get('to'),playerId:query.get('playerId'),kind:query.get('kind')??'settlements'}),media:query.has('shoeId')||['transactions','operations','workspace'].includes(query.get('view'))?undefined:mediaRegister});}
    catch(e){return json(res,400,{error:e.message});}
  }
  if (req.method === 'GET' && route === 'presentation') {
    const brand=new URL(req.url,'http://localhost').searchParams.get('brand')||'scout';
    try{const design=await readPresentation(brand),tag='"'+design.revision+'"';res.setHeader('ETag',tag);res.setHeader('Cache-Control','no-cache');if(req.headers['if-none-match']===tag){res.writeHead(304);return res.end();}return json(res,200,design);}
    catch{return json(res,503,{error:'Published design unavailable'});}
  }
  // MEDIA_BASE_URL (e.g. https://media.scoutgg.dev): where the game fetches dealer clips; empty = this host. Unset it to go back.
  if (req.method === "GET" && route === "clips") return json(res, 200, { ...MANIFEST, mediaBase: process.env.MEDIA_BASE_URL ?? "" });
  if (req.method === "GET" && route === "health") {
    return json(res, 200, { ok: true, demo: true });
  }
  if (route === "studio/session") {
    try { return json(res, 200, (await bo.user(req.headers)) ?? {}); }
    catch { return json(res, 503, { error: "Sign-in is unavailable. Try again shortly." }); }
  }
  if (route === "studio/login") {
    if (req.method !== "POST") return json(res, 405, { error: "Use POST" });
    if (!sameOrigin(req)) return json(res, 403, { error: "Invalid origin" });
    if (!apiLimit(clientAddress(req))) return json(res, 429, { error: "Too many attempts. Try again later." });
    try {
      const r = await bo.login(await body(req), clientAddress(req), req.headers["user-agent"]);
      if (r.status === 401) return json(res, 401, { error: "Wrong username or password." });
      if (r.status === 429) return json(res, 429, { error: "Too many attempts. Try again in 15 minutes." });
      if (r.status !== 200 || !r.cookie || !r.who) return json(res, 403, { error: "This account cannot sign in here." });
      res.setHeader("Set-Cookie", r.cookie);
      return json(res, 200, r.who);
    } catch { return json(res, 503, { error: "Sign-in is unavailable. Try again shortly." }); }
  }
  if (route === "studio/logout") {
    if (req.method !== "POST") return json(res, 405, { error: "Use POST" });
    if (!sameOrigin(req)) return json(res, 403, { error: "Invalid origin" });
    res.setHeader("Set-Cookie", bo.logoutCookie(req.headers["x-forwarded-proto"] === "https"));
    return json(res, 200, { ok: true });
  }
  // The signed-in account's own tables (Kevin 12 Oct: an aggregator only sees its own account).
  // What signed-in accounts did in the game, per sign-in (Kevin 12 Oct). Back office admins only; the BO reads it on this host.
  if (route === "studio/activity" && req.method === "GET") {
    let who;
    try { who = await bo.user(req.headers); } catch { return json(res, 503, { error: "Sign-in is unavailable. Try again shortly." }); }
    if (!who || !["admin", "superadmin"].includes(who.role)) return json(res, 403, { error: "Admins only" });
    const q = new URL(req.url, "http://x").searchParams;
    return json(res, 200, activity.list({ user: q.get("user") || null, since: q.get("since") || null }));
  }
  if (route === "studio/mine" && req.method === "GET") {
    let who;
    try { who = await bo.user(req.headers); } catch { return json(res, 503, { error: "Sign-in is unavailable. Try again shortly." }); }
    if (!who) return json(res, 401, { error: "Sign in required" });
    // Everyone with the demo password shares the Test Player account: never list its tables to them (prospects would see each other's).
    if (process.env.DEMO_BO_USER && who.user === process.env.DEMO_BO_USER) return json(res, 200, { tables: [] });
    return json(res, 200, { tables: studioTables.ownedBy(who.user).map(({ owner, logo, ...t }) => ({ ...t, url: studioTables.gameUrl(t) })) });
  }
  if (route === "studio/table") {
    if (req.method === "GET") {
      const t = studioTables.get(new URL(req.url, "http://x").searchParams.get("slug") ?? "");
      if (!t) return json(res, 404, { error: "No such table" });
      const { owner, ...pub } = t;   // the share link is public, the owner's account is not
      return json(res, 200, { ...pub, url: studioTables.gameUrl(pub) });
    }
    if (req.method !== "POST") return json(res, 405, { error: "Use GET or POST" });
    // Creating a table needs a signed-in back office user; the cookie-authenticated POST must come from this site.
    if (!sameOrigin(req)) return json(res, 403, { error: "Invalid origin" });
    let who;
    try { who = await bo.user(req.headers); } catch { return json(res, 503, { error: "Sign-in is unavailable. Try again shortly." }); }
    if (!who) return json(res, 401, { error: "Sign in required" });
    if (!apiLimit(clientAddress(req))) return json(res, 429, { error: "Please try again later" });
    // Room for an operator logo (a data URL up to LOGO_MAX); every other route keeps 20 KB.
    try {
      const input = await body(req, LOGO_MAX + 50000);
      if ((who.hiddenDealers ?? []).includes(input?.dealer)) return json(res, 403, { error: "That dealer is not available for this account" });
      const { owner, ...t } = studioTables.create(input, who.user);
      activity.log({ user: who.user, sid: sidOf(req.headers), ip: clientAddress(req), ua: req.headers["user-agent"], kind: "table.created", table: t.slug, detail: { name: t.name, dealer: t.dealer, room: t.room } });
      return json(res, 201, { ...t, url: studioTables.gameUrl(t) });
    }
    catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (req.method !== "POST") return json(res, 405, { error: "använd POST" });
  if (route !== "table" && !authorized(req.headers,API_TOKEN)) return json(res, 401, { error: "fel eller saknad token" });
  if(route!=='table'&&!apiLimit(clientAddress(req)))return json(res,429,{error:'Please try again later'});
  let b;
  try { b = await body(req); } catch (e) { return json(res, 400, { error: e.message }); }
  try {
    if (route === "table") {
      const out = table.handle(req, res, b);
      if ((b?.op === "join" || b?.op === "leave") && sidOf(req.headers)) {
        // A first visit gets its guest cookie in this very response: take it from there, so the rounds can be linked.
        const set = [].concat(res.getHeader("Set-Cookie") ?? []).join(";"), guest = guestToken(req.headers) ?? /astrid_guest=([a-f0-9]{64})/.exec(set)?.[1] ?? null;
        const ev = { sid: sidOf(req.headers), ip: clientAddress(req), ua: req.headers["user-agent"], kind: b.op === "join" ? "seated" : "left", table: String(b.session ?? "").slice(0, 64), guest };
        bo.user(req.headers).then(w => w && activity.log({ user: w.user, ...ev })).catch(() => {});
      }
      return out;
    }
    if (route === "chat") {
      const text = String(b.text ?? "").trim().slice(0, 280);
      if (!text) return json(res, 400, { error: "text saknas" });
      return json(res, 200, await chat(String(b.who ?? "Player").slice(0, 18), text,'astrid',guestToken(req.headers)));
    }
    if (route === "speak") {
      const text = String(b.text ?? "").trim().slice(0, 280);
      if (!text) return json(res, 400, { error: "text saknas" });
      return json(res, 200, await speak(text));
    }
    if (route === "event") {
      const m = event(String(b.id ?? ""));
      return m ? json(res, 200, m) : json(res, 404, { error: "okänt id — se GET /api/clips" });
    }
  } catch (e) {
    try { safetyAudit.write({event:"integration_error",decision:"request_failed"}); } catch {}
    return json(res, 503, { error: "Request could not be completed" });
  }
  json(res, 404, { error: "okänd väg" });
}

// A request that cannot be handled (a path like "//x" that URL rejects, a bad %-escape) answers 400; it must never
// throw out of the handler, because an unhandled rejection stops the process and drops every table (12 Oct).
const http = createServer((req, res) => {
  handleHttp(req, res).catch(e => {
    console.error("request failed", String(req.url).slice(0, 120), e?.message);
    try { if (!res.headersSent) res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }); res.end(); } catch {}
  });
});
async function handleHttp(req, res) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'");
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  if (p.startsWith("/api/")) { api(req, res, p.slice(5)).catch(() => json(res, 500, { error: "Request could not be completed" })); return; }
  if(p.startsWith('/answers/')){
    // Worker/session metadata is private; only generated MP4s can be served.
    if(!/^\/answers\/[a-f0-9-]{36}\.mp4$/.test(p))return json(res,404,{error:'Not found'});
    const file=path.join(ANSWERS,path.basename(p));
    try{if(statSync(file).mtimeMs<Date.now()-86400000)return json(res,404,{error:'Expired'});}catch{return json(res,404,{error:'Not found'});}
    res.setHeader('Cache-Control','private, no-store');return sendFile(req,res,file);
  }
  // The demo starts at the Table Studio sign-in (John's flow: login, build, ready, play). Every game link carries
  // a query (/t/<slug> redirects to /?dealer=…&session=…), so only the bare address moves.
  if(p==="/"&&!new URL(req.url,"http://x").search){res.writeHead(302,{Location:"/studio/","Cache-Control":"no-store"});res.end();return;}
  if(p==="/studio"){res.writeHead(302,{Location:"/studio/","Cache-Control":"no-store"});res.end();return;}
  if(p==="/studio/")return sendFile(req,res,path.join(PUBLIC,"studio","index.html"));
  const shared=/^\/t\/([a-z0-9_-]{1,40})\/?$/.exec(p);
  if(shared){const t=studioTables.get(shared[1]);res.writeHead(t?302:404,t?{Location:studioTables.gameUrl(t),"Cache-Control":"no-store"}:{"Content-Type":"text/plain; charset=utf-8"});res.end(t?"":"No such table");return;}
  if(["/backoffice","/backoffice/","/backoffice.html"].includes(p)){res.writeHead(302,{Location:"https://croupier.scoutgg.dev/bo/#shoes","Cache-Control":"no-store"});res.end();return;}
  // Play demo password (Kevin 12 Oct): the website's /demo posts here; the right password gives a signed 30-day pass.
  if(p==="/demo/unlock"&&req.method==="POST"){
    const from=req.headers.origin??"";
    if(from&&!["https://scoutgaminggroup.com","https://www.scoutgaminggroup.com","https://croupier.scoutgg.dev"].includes(from)){res.writeHead(403).end();return;}
    if(!demoLimit(clientAddress(req))){res.writeHead(303,{Location:demoGate.passwordPage+"?wrong=limit","Cache-Control":"no-store"});res.end();return;}
    let raw="";req.on("data",c=>{raw+=c;if(raw.length>2000)req.destroy();});
    // Kevin 12 Oct: one path, no parallel solution. The right password signs the visitor in as the shared Test Player
    // back office account (DEMO_BO_USER/DEMO_BO_PASS, an aggregator) and they go through Table Studio like everyone else.
    req.on("end",async()=>{const pw=new URLSearchParams(raw).get("pw");
      if(!demoGate.rightPassword(pw)){res.writeHead(303,{Location:demoGate.passwordPage+"?wrong=1","Cache-Control":"no-store"});res.end();return;}
      let r=null; try{ if(process.env.DEMO_BO_USER&&process.env.DEMO_BO_PASS) r=await bo.login({user:process.env.DEMO_BO_USER,pass:process.env.DEMO_BO_PASS},clientAddress(req),req.headers["user-agent"]); }catch{}
      if(r?.status===200&&r.cookie){res.writeHead(303,{Location:"/studio/?resume","Set-Cookie":r.cookie,"Cache-Control":"no-store"});res.end();return;}
      console.error("demo unlock: Test Player sign-in failed", r?.status??"no account");
      res.writeHead(303,{Location:demoGate.passwordPage+"?wrong=down","Cache-Control":"no-store"});res.end();});
    return;
  }
  const file = p === "/" ? path.join(PUBLIC, "index.html") : inside(PUBLIC, p.slice(1));
  if (!file) { res.writeHead(404).end(); return; }
  // A Table Studio table plays its own dealer in its own session (Kevin 12 Oct, edge cases): a shared link edited to
  // ?dealer=marten, or pointed at another session, goes back to the table's own link, so a dealer hidden for the
  // account that built the table cannot be called up through it.
  if(file===path.join(PUBLIC,"index.html")){
    const q=new URL(req.url,"http://x").searchParams, t=studioTables.get(q.get("table")??"");
    if(t&&(q.get("dealer")!==t.dealer||q.get("session")!==t.slug)){res.writeHead(302,{Location:studioTables.gameUrl(t),"Cache-Control":"no-store"});res.end();return;}
  }
  // The gate goes by the file, not the path: /index.html and /%69ndex.html are the game page as well.
  if(file===path.join(PUBLIC,"index.html")&&demoGate.on){   // one path (Kevin 12 Oct): a Table Studio table or a signed-in back office account, nothing else
    const q=new URL(req.url,"http://x").searchParams, studioTable=studioTables.get(q.get("table")??"");
    let who=null; if(!studioTable){try{who=await bo.user(req.headers);}catch{}}
    if(!studioTable&&!who){res.writeHead(302,{Location:demoGate.passwordPage,"Cache-Control":"no-store"});res.end();return;}
  }
  if (file === path.join(PUBLIC, "index.html") && sidOf(req.headers)) {
    const q = new URL(req.url, "http://x").searchParams;
    const ev = { sid: sidOf(req.headers), ip: clientAddress(req), ua: req.headers["user-agent"], kind: "table.opened", table: q.get("session") || "astrid", guest: guestToken(req.headers), detail: { dealer: q.get("dealer") } };
    bo.user(req.headers).then(w => w && activity.log({ user: w.user, ...ev })).catch(() => {});
  }
  sendFile(req, res, file);
}

// Två websocket-vägar på samma port: rummet på / och GPU-arbetarens uppringning på /lipsync-worker.
const room = new WebSocketServer({ noServer: true, maxPayload:4096 });
const workers = new WebSocketServer({ noServer: true });
http.on("upgrade", (req, socket, head) => {
  let url; try { url = new URL(req.url, "http://x"); } catch { socket.destroy(); return; }
  if (url.pathname === "/lipsync-worker") workers.handleUpgrade(req, socket, head, (ws) => (pod ?? lip).adoptWorker(ws, url));
  else {
    try { if(!sameOrigin(req)){socket.destroy();return;} }
    catch {socket.destroy();return;}
    let session;try{session=sessionName(url.searchParams.get('session')??'astrid');}catch{socket.destroy();return;}
    room.handleUpgrade(req, socket, head, (ws) => {ws.session=session;ws.address=clientAddress(req);ws.guest=guestToken(req.headers);ws.sid=sidOf(req.headers);ws.ua=req.headers["user-agent"];if(ws.sid)bo.user(req.headers).then(w=>{ws.boUser=w?.user??null;}).catch(()=>{});room.emit("connection",ws);});
  }
});

room.on("connection", (ws) => {
  ws.name = `${NAMES[seq % NAMES.length]} ${Math.floor(seq / NAMES.length) + 1}`;
  seq++;
  clients.add(ws);
  if(!localQA)lip.notifyPlayers(clients.size);
  const hello = () => send(ws, { t: "hello", name: ws.name, log:roomLog(ws.session), thinking: astrid.working, queued: astrid.queued, status: lip.status });
  hello();
  broadcast({ t: "here", count: [...clients].filter(c=>c.session===ws.session).length },ws.session);

  ws.on("message", (raw) => {
    let j; try { j = JSON.parse(raw.toString()); } catch { return; }
    if (j.t === "name" && typeof j.name === "string") {
      const clean = j.name.trim().slice(0, 18);
      if (clean) { ws.name = clean; send(ws,{t:"named",name:clean}); }
    } else if (j.t === "warm") {
      if (hasVoice(j.dealer)) draggeWarm(j.dealer);   // a Dragge or Paow viewer arrived: take the GPU warm-up now
    } else if (j.t === "roundResult") {
      roundResultReply(ws, j.roundId, j.dealer).catch(() => {});
    } else if (j.t === "say") {
      const text = String(j.text ?? "").trim().slice(0, 280);
      if(text&&ws.boUser)activity.log({user:ws.boUser,sid:ws.sid,ip:ws.address,ua:ws.ua,kind:"chat",table:ws.session,guest:ws.guest,detail:{len:text.length}});   // never the text
      if(!chatLimit(ws.address)){send(ws,{t:'notice',text:'Please wait a minute before sending more messages.'});return;}
      if(ws.guest&&shared.paused(ws.guest)){send(ws,{t:'notice',text:RESPONSES.support});return;}
      // Dragge, Paow and Mårten (a viewer's alternative dealers) answer with their own brain and memory, Dragge
      // and Paow also with their voice (Mårten has none yet: text only); Astrid keeps her reviewed pipeline below.
      const alt=['dragge','paow','marten'].includes(j.dealer)?j.dealer:null;
      if(text&&alt&&!['privacy','support'].includes(localResponse(text))){
        // Never leave them "thinking": any failure still answers with a reviewed line.
        talkReply(ws,text,alt).catch(()=>{send(ws,{t:'answer',id:`r${Date.now().toString(36)}`,to:ws.name,dealer:alt,text:localizeResponse(RESPONSES.social,shared.language(ws.session))});send(ws,{t:'thinking',on:false,queued:0});});
        return;
      }
      if(text&&localQA){send(ws,{t:'notice',text:'Voice providers are disabled in this local test.'});return;}
      if (text) chat(ws.name, text,ws.session,ws.guest).catch(() => {});
    } else if (j.t === "event") {
      safetyAudit.write({event:'manual_event_blocked',decision:'public_socket'});
      send(ws,{t:'notice',text:'Game announcements are controlled by the game server.'});
    }
  });
  const gone = () => { clients.delete(ws); broadcast({ t: "here", count: [...clients].filter(c=>c.session===ws.session).length },ws.session); if(!localQA)lip.notifyPlayers(clients.size); };
  ws.on("close", gone);
  ws.on("error", gone);
});

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { clearInterval(tableTick); (pod ?? lip).close(); tts.close(); table.close(); shared.close(); safetyAudit.close(); process.exit(0); });

http.listen(PORT, process.env.BIND_HOST ?? "0.0.0.0", () => {
  console.log(`Astrid demo 2.0 på http://127.0.0.1:${PORT}`);
  console.log(`läppsynk: RunPod ${lip.endpointId} · röst: Cartesia ${tts.voiceId} · text: ${astrid.llm.model}`);
  if (!lip.sessionUrlFn()) console.log("  ingen publik adress än (npm run share skriver den) — utan den går svaren jobbvägen, ~1 s långsammare");
  if(!localQA)tts.connect().then(() => console.log("cartesia: ansluten")).catch((e) => console.warn(`cartesia: ${e.message}`));
});
