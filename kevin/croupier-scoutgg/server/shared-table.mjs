import {catalogEventForStep,CATALOG_COMMIT} from '../public/runtime-event-links.js';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { command, gameView, newGame } from '../vendor/croupier/shoe-game.mjs';
import {createTransactions} from './transactions.mjs';
import {readOperations} from './operations.mjs';
import {readBackofficeWorkspace} from './bo-workspace.mjs';
import { createGameAudit } from './game-audit.mjs';
import { planDraws, outcomeSpeech, total } from '../public/game-events.js';
import {dealerLanguage,availableLanguages,speechForEvent,RETIRED_LINES} from '../public/dealer-language.js';
import {personalizedGreeting} from './dealer-responses-localized.mjs';
import {DEFAULT_LIMITS} from './studio-tables.mjs';
import {scheduleTalks,LJUD_FORE,idleFrom,idleChain} from './rorlig-lipsync.mjs';
import {waitClips,waitBoundary,phasePool} from '../public/idle-chain.js';

const emptyBets = () => Array.from({length:7},()=>({main:0,pp:0,tp:0}));
const sum = b => b.main+b.pp+b.tp;
const money = n => `$${n.toLocaleString('en-US')}`;
// The table's limits on every box: a main bet from min to max, side bets up to sideMax.
function checkLimits(bets,L) {
  for(const b of bets) {
    if(b.main>L.max)throw new Error(`Maximum ${money(L.max)} per bet`);
    if(b.pp>L.sideMax||b.tp>L.sideMax)throw new Error(`Side bets up to ${money(L.sideMax)}`);
    if(b.main>0&&b.main<L.min)throw new Error(`Minimum ${money(L.min)} per box`);
  }
}
export function sessionName(value='astrid') {
  if (typeof value!=='string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(value)) throw new Error('Invalid table link');
  return value.toLowerCase();
}
export function cleanPlayerName(value) {
  const name=String(value??'').normalize('NFC').trim().replace(/\s+/g,' ');
  if (!/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '.-]{0,17}$/u.test(name)) throw new Error('Enter a name using 1 to 18 letters or numbers');
  return name;
}
const keyFor=token=>createHash('sha256').update(token).digest('hex');

// limitsFor(room): the betting limits that room plays with (studio-tables.mjs); the default is the demo's original.
// languageFor(room): the dealer language a new room opens in (a studio table's choice); players can still change it.
// readyFor(room): a ready dealer's take lengths (meta.json frames) when the room is his studio table, else null.
// talk(room): {line(clip, language)} when the room's ready dealer can speak over his moving clips (rorlig-lipsync.mjs), else
// null; onPlan(room, plan, ready, {nya, omplanera, steg}) then hands the new lines to the lip-sync worker, and the lines still
// speaking when the new plan's cards come (their frames changed) for a new map; steg = the previous plan's steps + this one's.
// The talk track lives on the room (r.talk), so an answer or a line outlives the plan it started in.
const IDLE_SEAT_MS=90000;
// Kevin 24 Oct (full table): while someone waits for a place a player keeps at most this many boxes after a round
const MAX_BOXES_WHEN_WAITING=3,WAITING_MS=30000;
export function createSharedTable(filename,{manifest,now=Date.now,onWelcome=()=>{},betMs=20000,actionMs=15000,limitsFor=()=>DEFAULT_LIMITS,languageFor=()=>null,readyFor=()=>null,talk=()=>null,onPlan=()=>{},winners=()=>null,tempoFor=()=>1}={}) {
  const talkFor=talk;
  const db=new DatabaseSync(filename);db.exec('PRAGMA journal_mode=WAL;PRAGMA synchronous=NORMAL');   // WAL + NORMAL: a bet's COMMIT no longer waits on a full fsync (Kevin 22 Oct)
  db.exec(`CREATE TABLE IF NOT EXISTS shared_rooms (id TEXT PRIMARY KEY, state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS shared_players (room TEXT NOT NULL, token TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, balance REAL NOT NULL, seen REAL NOT NULL, last_return REAL, PRIMARY KEY(room,token));
    CREATE TABLE IF NOT EXISTS shared_settlements (room TEXT NOT NULL, round_id TEXT NOT NULL, player_id TEXT NOT NULL, receipt TEXT NOT NULL, PRIMARY KEY(room,round_id,player_id));
    CREATE INDEX IF NOT EXISTS shared_settlement_player ON shared_settlements(room,player_id);
    CREATE TABLE IF NOT EXISTS demo_breaks (token TEXT PRIMARY KEY, until_ms INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS shared_requests (room TEXT NOT NULL, token TEXT NOT NULL, id TEXT NOT NULL, input TEXT NOT NULL, PRIMARY KEY(room,token,id));`);
  const audit=createGameAudit(db,now),transactions=createTransactions(db,now),contexts=new WeakMap();
  const languages=availableLanguages(manifest);
  const clipByEvent=(event,language)=>speechForEvent(manifest,event,language);
  // a line of a ready dealer's own (twentyone) has no clip of Astrid's: its first variant stands in until variantOf picks
  const ownLine=event=>({id:`${event}_1`,event,url:`/media/repliker/${event}_1.mp4`,text:'',dur:2});
  // Kevin 20 Oct: a ready dealer with moving idles (readyFor().idle, v2/idle1.mp4 …) keeps moving while he speaks at rest,
  // instead of freezing on his still: the talk carries the chain of idle takes every viewer and the worker's map follow
  // (rorlig-lipsync.mjs idleChain). Only when no card can come and cut it: between rounds, or once the round is settled
  // (his last take ends at rest and he talks about the result). Mid-round he waits in his pose as before (11 Oct).
  // Only the idle takes a connected lip-sync worker announced (talker.idle, rorlig-lipsync.mjs idleTakes) go into the
  // chain: with a worker that has the deals only (ko2) he rests on his still with the mouth on it, as before.
  // Kevin 23 Oct (dealerblackjack, mouth still): a line at rest that starts while an earlier line's chain is on screen (the
  // side-bet line, then the result) goes on with that chain: same start and seed, so the same clips (layChain only extends
  // it), instead of a chain of its own from its first frame. Viewers keep showing the first chain; the mouth was mapped on
  // the second, so not one patch landed. prior: the talks before it (the room's, and this plan's earlier lines).
  function withIdle(r,ready,t,steg,talker,prior=r.talk??[]) {
    // a talk's own chain: takes from VILA to VILA the worker announced (a take into or out of the clasped hands, dealers.js
    // from/to, never joins a chain laid at rest)
    const takes=(ready?.idle??[]).filter(i=>talker?.idle?.includes(i.take)&&!i.from&&!i.to);
    if(!takes.length)return t;
    // Kevin 20 Oct: during a wait for a player the talk runs over the wait's own chain, the body every viewer shows anyway.
    // Kevin 23 Oct: not over a wait clip the worker has not announced (the new idles): the talk then rests on his still
    const w=(r.waits??[]).find(w=>w.from<t.endAt+600&&(!w.until||w.until>t.kartaStart));
    if(w){const idle=waitClips(w,t.kartaStart,t.endAt+600);return idle.length&&idle.every(c=>talker.idle.includes(c.take))?{...t,idle}:t;}
    if(r.phase==='round'&&r.round?.phase!=='settled')return t;
    const from=idleFrom(steg,t,{restEnd:ready.restEnd??[]});
    if(from===null)return t;
    const on=prior.find(o=>o.id!==t.id&&o.chain&&o.idle?.length&&o.kartaStart<t.kartaStart&&o.idle[0].startAt<=from&&o.idle.at(-1).endAt>from);
    const chain=on?on.chain:{from,seed:t.id};
    const idle=idleChain(takes,chain.from,t.endAt+600,chain.seed);
    return idle.length?{...t,idle,chain}:t;
  }
  function variantOf(r,clip,ready){
    const n=ready.variants[clip.event],last=r.lastVariant?.[clip.event];
    const pick=[...Array(n).keys()].map(i=>i+1).filter(i=>!RETIRED_LINES.has(`${clip.event}_${i}`)&&(n<2||i!==last));
    if(!pick.length)return clip;   // every variant retired: the event's active line (dealer-language.js activeLine)
    const k=pick[Math.floor(Math.random()*pick.length)];
    r.lastVariant={...(r.lastVariant??{}),[clip.event]:k};
    const id=`${clip.event}_${k}`;
    return{...clip,id,url:`/media/repliker/${id}.mp4`,dur:ready.durs?.[id]??clip.dur};
  }
  // players up on the round: what came back (main, side bets) over what they staked (main, doubles, side bets, insurance),
  // the same sums the settlement pays out
  function netWinners(id,r){
    return players(id).filter(p=>{const hands=r.round.hands.filter(h=>r.owners[h.box]===p.id);if(!hands.length)return false;
      return hands.reduce((n,h)=>n+h.result+h.sideReturn,0)>hands.reduce((n,h)=>n+h.stake+h.pp+h.tp+(h.insured||0),0);});
  }
  // a name the dealer can say: a guest's "Guest 826" is not one
  const spokenName=name=>{const s=String(name??'').replace(/[^\p{L}\p{N} .'-]/gu,'').trim().slice(0,24);return !s||/^guest\s*\d*$/i.test(s)?null:s;};
  const load=id=>{const row=db.prepare('SELECT state FROM shared_rooms WHERE id=?').get(id);const r=row?JSON.parse(row.state):{language:languages.includes(languageFor(id))?languageFor(id):undefined,game:newGame(),version:0,owners:Array(7).fill(null),bets:emptyBets(),history:{},ready:[],phase:'bets',deadline:null,actionDeadline:null,insurance:{},plan:null,round:null};contexts.set(r,{id,parent:null,engine:null});return r;};
  // Kevin 24 Oct, prod at 100 % CPU: tick loaded and saved every room 4 times a second (740 rooms, most of them old Table
  // Studio tables nobody sits at). A room saved with nothing that advance() acts on (no round, deadline, seat, bet, ready
  // or leaver) is quiet: tick skips it until something saves it again (every write goes through save)
  const quiet=new Set();
  const isQuiet=r=>r.phase==='bets'&&!r.deadline&&!(r.leaving?.length)&&!(r.ready?.length)&&!(r.owners??[]).some(Boolean)&&!(r.bets??[]).some(b=>b&&(b.main||b.pp||b.tp));
  const save=(id,r)=>{audit.sync(id,r.game);if(isQuiet(r))quiet.add(id);else quiet.delete(id);return db.prepare('INSERT INTO shared_rooms VALUES (?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state').run(id,JSON.stringify(r));};
  const players=id=>db.prepare('SELECT * FROM shared_players WHERE room=?').all(id);
  const pausedUntil=token=>db.prepare('SELECT until_ms FROM demo_breaks WHERE token=?').get(token)?.until_ms??0;
  const player=(id,token)=>db.prepare('SELECT * FROM shared_players WHERE room=? AND token=?').get(id,token);
  const amount=(id,p,delta,kind,roundId=null)=>{
    const before=db.prepare('SELECT id,name,balance FROM shared_players WHERE room=? AND id=?').get(id,p);
    db.prepare('UPDATE shared_players SET balance=ROUND(balance+?,2) WHERE room=? AND id=?').run(delta,id,p);
    const after=db.prepare('SELECT balance FROM shared_players WHERE room=? AND id=?').get(id,p).balance;
    transactions.record(id,before,roundId,kind,before.balance,after);
  };
  const owned=(r,p)=>r.owners.flatMap((owner,i)=>owner===p?[i]:[]);
  const move=(r,op,extra={})=>{
    const context=contexts.get(r),prior=r.game.shoe?.id,drawn=r.game.shoe?.dealt??1;
    audit.sync(context.id,r.game);
    const result=command(r.game,{op,version:r.game.version,requestId:randomUUID(),...extra},Number.MAX_SAFE_INTEGER).view;
    audit.sync(context.id,r.game);
    context.engine=audit.event(context.id,r.roundId,`engine.${op}`,{...extra,cause:context.parent?{eventId:context.parent,source:'player request'}:{source:'automatic table progression'},shoeId:r.game.shoe.id,version:r.game.version,draws:r.game.shoe.proof?.draws.filter(d=>d.position>(prior===r.game.shoe.id?drawn:1))??[],phase:result.round?.phase??'collected'},context.parent);
    return result;
  };
  // A ready dealer's takes join (REDO to REDO): he reaches for the shoe once, deals the run of cards back to back
  // and returns to rest after the last. Each card gets its own take length, not Astrid's filmed slot, and the
  // step says which variant ('i' opens a run, 'u' closes it) so every viewer plays the same frames.
  // tempo (Emil 28 Oct, a studio table's Slow 1 / Normal 1.5 / Fast 2 / Turbo 2.5): his deal takes play that much faster
  // (the client's playbackRate = step.rate). A take's frames stay its own (clip.dur, card tracks, the lip-sync map count
  // them in media time); only the wall-clock slot shrinks. Speech, idles and the waits for the other players do not.
  function readyTimeline(steps,ready,tempo=1) {
    const dealing=s=>s?.clip&&(s.kind==='deal'||s.kind==='reveal');
    // Some takes start or end at REST instead of REDO (Paow's hole card ends at rest, her filmed turn goes rest to
    // rest): meta lists them, so a take after one reaches for the shoe again and none jumps between the two poses.
    const take=s=>s.track??s.seat,restEnd=s=>(ready.restEnd??[]).includes(take(s)),restStart=s=>(ready.restStart??[]).includes(take(s));
    const joined=(a,b)=>dealing(a)&&dealing(b)&&!restEnd(a)&&!restStart(b);
    let at=steps[0].startAt;
    steps.forEach((s,i)=>{
      const length=s.endAt-s.startAt;s.startAt=at;
      if(dealing(s)){
        s.variant=(joined(steps[i-1],s)||restStart(s)?'':'i')+(joined(s,steps[i+1])||restEnd(s)?'':'u');
        // Emil's rest takes (deal_pos<p>vila): a card that ends the run (a hit, the last card) lets go of the shoe on
        // film and lands at rest, instead of the REDO take plus the walk back. Its own card track is '<take>v'.
        const t=take(s),rest=s.variant.endsWith('u')&&ready.frames[t]?.[`-${s.variant.slice(0,-1)}v`];
        if(rest){s.variant=s.variant.slice(0,-1)+'v';s.track=`${t}v`;}
        const frames=ready.frames[t]?.[`-${s.variant}`];
        if(frames){s.endAt=at+frames/24/tempo*1000;s.clip={...s.clip,dur:frames/24};s.frames=frames;if(tempo!==1)s.rate=tempo;}else s.endAt=at+length;
      }else s.endAt=at+length;
      at=s.endAt+(s.clip&&!joined(s,steps[i+1])?80:0);
    });
    return at;
  }
  function sequence(r,before,{opening=false,prefix=[]}={}) {
    // The dealer's turn opens on the hole-card flip with nothing before it. The other players learn of a plan on
    // their next poll (700 ms), so a 700 ms lead would start the flip before they have it and they would join it
    // halfway. Give that plan time for one more poll; a player's own move keeps the short lead.
    // Emil 14 Oct: a ready dealer with the new lines (variants, see readyFor) calls a blackjack or a 21 as it lands
    const calls=Boolean(readyFor(contexts.get(r).id)?.variants?.twentyone);
    const draws=planDraws(before,r.round,opening,{calls});
    // Emil 12 Oct: the next player may act once the last card has landed (turnAt below), while the dealer still brings her
    // hand back to rest and talks about the bust. A card asked for then starts when that take has ended, never cutting it.
    const roomId=contexts.get(r).id,ready=readyFor(roomId),talker=ready?talk(roomId):null,talks=[],tempo=ready?tempoFor(roomId):1;
    const clipFor=event=>clipByEvent(event,r.language)??(ready?.variants?.[event]?ownLine(event):null);
    // Emil 13 Oct: while the dealer speaks, a card asked for gives the lip-sync worker 1 s (not 0.7) to remake the mouth
    // over the new take; without speech the pace is as before
    const speaking=Boolean(talker)&&(r.talk??[]).some(t=>t.startAt<=now()&&t.endAt>now()+300);
    // Kevin 23 Oct: a dealer with the clasped-hands idles may be in that pose on any viewer's screen when the round starts
    // (each viewer's betting idles are his own): the first card comes 1.4 s after ready, time to unclasp (app.js unclaspFor)
    const unclasp=opening&&(ready?.idle??[]).some(i=>i.from==='knappt')?1400:0;
    const steps=[];let at=Math.max(now()+Math.max(unclasp,!prefix.length&&draws[0]?.kind==='reveal'?1500:speaking?1000:700),r.plan?.endAt??0);
    // Kevin 20 Oct: a wait's idle chain is running: the next take starts on its next clip boundary (at most one short take
    // later), from VILA, so there is no jump in his face; the wait then ends there (until)
    const open=(r.waits??[]).find(w=>!w.until);
    if(open){at=waitBoundary(open,at);open.until=at;}
    const addClip=(clip,meta={})=>{if(!clip)return;
      // Emil 14 Oct: a ready dealer says one of his variants of a line, never the same one twice in a row (always the
      // first one sounded like a robot); a line only he has (twentyone) comes from his variants too
      if(ready?.variants?.[clip.event]&&(meta.kind??'speech')==='speech')clip=variantOf(r,clip,ready);
      // the caption is what this dealer says in that line, in the language he says it (Emil 14 Oct: it showed Astrid's English)
      if(ready?.texts&&(meta.kind??'speech')==='speech'){const lang=ready.texts[dealerLanguage(r.language)]?dealerLanguage(r.language):'en',said=ready.texts[lang]?.[clip.id];if(said)clip={...clip,text:said};}
      // Emil 12 Oct: a ready dealer with a warm lip-sync worker says the line WHILE he deals. It leaves the timeline and is
      // timed after readyTimeline (scheduleTalks); no line of his own in that language -> it stays a step as before.
      if(talker&&(meta.kind??'speech')==='speech'){const line=talker.line(clip,dealerLanguage(r.language));if(line){talks.push({after:steps.length,event:clip.event,clip:{id:clip.id,url:clip.url,text:clip.text},line:line.url,lang:line.lang,dur:line.dur});return;}}
      const duration=Math.max(.1,Number(clip.dur)||3)*1000;steps.push({...meta,kind:meta.kind??'speech',clip:{id:clip.id,event:clip.event,url:clip.url,dur:duration/1000,text:clip.text,sound:!['deal','reveal','hands'].includes(meta.kind)},startAt:at,endAt:at+duration});at+=duration+80;};
    prefix.forEach(e=>addClip(clipFor(e)));
    // Before the first card a ready dealer shows both hands empty (Serhiy): his take goes rest to rest.
    const hands=ready?.hands;
    if(opening&&hands&&ready.dir)addClip({id:'hands',event:'hands',url:`${ready.dir}hands.mp4`,dur:hands/24},{kind:'hands'});
    for(const s of draws) {
      if(s.kind==='deal')addClip(manifest.deal.find(c=>c.id===s.clipId),{kind:'deal',seat:s.seat,track:s.track,shoeDraw:s.shoeDraw});
      else if(s.kind==='speech')addClip(clipFor(s.event));
      else {const flip=manifest.deal.find(c=>c.id==='deal_flip');if(flip)addClip(flip,{kind:'reveal',seat:'dealer',track:'flip',shoeDraw:r.round.holeDraw});else steps.push({kind:'reveal',startAt:at,endAt:at});}
    }
    if(opening&&r.round.hands.some(h=>h.sideReturn>0))addClip(clipByEvent('sidebet',r.language));
    if(r.round.phase==='insurance')addClip(clipByEvent('insurance',r.language));
    // Emil 14 Oct: with calls the table's result congratulates only players who won money this round (net, over all
    // their boxes), by name when the dealer can say it live (winners hook), else the recorded "congratulations to the
    // winners". A player who won one box but lost more hears no congratulations; nobody up: no line.
    let cheer=null;
    if(r.round.phase==='settled'){
      const ev=outcomeSpeech(r.round);
      if(calls&&['win','blackjack','dealerbust'].includes(ev)){
        const up=netWinners(contexts.get(r).id,r),named=up.map(p=>spokenName(p.name)).filter(Boolean);
        const say=up.length&&named.length===up.length&&named.length<=4?winners(contexts.get(r).id):null;
        if(say)cheer={say,names:named};else if(up.length)addClip(clipFor('win'));
      }else addClip(clipFor(ev));
    }
    if(r.round.phase==='decisions')steps.push({kind:'turn',seat:r.round.hands[r.round.active].box+1,startAt:at,endAt:at});
    for(const step of steps){step.catalogEventId=catalogEventForStep(step);step.catalogCommit=CATALOG_COMMIT;}
    if(ready&&steps.length)at=readyTimeline(steps,ready,tempo);
    const spoken=[];for(const t of talks.length?scheduleTalks(talks,steps,{free:Math.max(r.talkUntil??0,now()+1200),end:at}):[])spoken.push(withIdle(r,ready,{id:randomUUID(),kind:'line',...t},[...(r.plan?.steps??[]),...steps],talker,[...(r.talk??[]),...spoken]));
    if(spoken.length)r.talkUntil=spoken.at(-1).endAt+250;
    const firstFrame=steps.find(x=>x.clip)?.startAt??Infinity;
    const live=(r.talk??[]).filter(t=>t.endAt>now()),omplanera=live.filter(t=>t.endAt+600>firstFrame);
    r.talk=[...live,...spoken];r.prevSteps=r.plan?.steps??[];
    // turnAt: when the table's next decision may be taken — the last card landed (~62 % into its take) when the plan hands
    // the turn on, else the plan's end
    const lastDeal=[...steps].reverse().find(x=>x.clip&&(x.kind==='deal'||x.kind==='reveal'));
    const handsOn=steps.some(x=>x.kind==='turn')&&ready&&lastDeal&&!steps.some(x=>x.kind==='speech'&&x.startAt>lastDeal.startAt);
    const turnAt=handsOn?Math.round(lastDeal.startAt+.62*(lastDeal.endAt-lastDeal.startAt)):at;
    r.plan={id:randomUUID(),language:dealerLanguage(r.language),before,steps,startAt:now(),endAt:at,turnAt,...(tempo!==1?{tempo}:{})};
    // Kevin 20 Oct: the table waits for a player after this plan (hit or stand, insurance): from its end, back at VILA,
    // his idle takes run as a chain on the table clock (public/idle-chain.js waitClips) instead of him standing still,
    // the same for every viewer and the worker's map, until the next take. The wait before it stays until its take.
    // only takes the connected worker announced go into the wait chain (Kevin 21 Oct: the new idles may not be in the
    // worker image yet, and a line over the wait maps onto these takes); no worker with idle takes: all of them, his body only
    const known=talker?.idle?.length?(ready?.idle??[]).filter(i=>talker.idle.includes(i.take)):(ready?.idle??[]);
    // Kevin 21 Oct: while he waits for the player only the calm takes (dealers.js calm: breathing, shoulders, back, weight,
    // fingers): too much head movement before. None calm among the announced: his plain breathing take, if he has it
    // Kevin 23 Oct: the hands flat on the felt and the lean forward (dealers.js fas decide) dominate this wait, announced by
    // the worker or not (a line over a wait clip the worker cannot map rests on his still, withIdle); the clasped hands
    // (fas bets) are the betting's
    const calm=known.filter(i=>i.calm&&!i.fas),decide=(ready?.idle??[]).filter(i=>i.fas==='decide');
    const pool=calm.length||decide.length?phasePool([...calm,...decide],'decide'):(ready?.idle??[]).filter(i=>i.take==='andas');
    const waiting=Boolean(r.round&&['decisions','insurance'].includes(r.round.phase)&&pool.length);
    r.waits=[...(r.waits??[]).filter(w=>w.until&&w.until>now()-2000),...(waiting?[{from:at,until:null,seed:r.plan.id,takes:pool.map(({take,frames,vikt})=>({take,frames,vikt:vikt??1}))}]:[])];
    const context=contexts.get(r);audit.event(context.id,r.roundId,'presentation.plan',{planId:r.plan.id,language:r.plan.language,steps,status:'scheduled; not a playback acknowledgement'},context.engine);
    r.actionDeadline=at+actionMs;
    r.version++;
    if(spoken.length||omplanera.length)onPlan(roomId,r.plan,ready,{nya:spoken,omplanera,steg:[...r.prevSteps,...steps]});
    // the names are said once the last card has landed (the hook voices them and adds them to the talk track itself)
    if(cheer){const last=[...steps].reverse().find(x=>x.clip&&(x.kind==='deal'||x.kind==='reveal'));cheer.say(cheer.names,dealerLanguage(r.language),last?Math.round(last.startAt+.62*(last.endAt-last.startAt)):at);}
  }
  function start(id,r) {
    if(r.phase!=='bets'||!r.bets.some(b=>b.main))throw new Error('Place your bets please');
    for(const p of players(id))if(owned(r,p.id).reduce((n,i)=>n+sum(r.bets[i]),0)>p.balance)throw new Error('Insufficient demo balance');
    r.roundId=randomUUID();
    audit.event(id,r.roundId,'round.started',{owners:[...r.owners],bets:structuredClone(r.bets),triggerEvent:contexts.get(r).parent});
    const L=limitsFor(id);checkLimits(r.bets,L);
    r.round=move(r,'start',{bets:r.bets,limits:{min:L.min,max:L.max,sideMax:L.sideMax}}).round;
    r.lastBets??={};for(const p of players(id)){const mine=Object.fromEntries(owned(r,p.id).filter(i=>r.bets[i].main).map(i=>[i,{...r.bets[i]}]));if(Object.keys(mine).length)r.lastBets[p.id]=mine;}
    for(const p of players(id)){const stake=owned(r,p.id).reduce((n,i)=>n+sum(r.bets[i]),0);if(stake)amount(id,p.id,-stake,'stake',r.roundId);}
    r.phase='round';r.deadline=null;r.insurance={};r.history={};r.ready=[];
    sequence(r,null,{opening:true,prefix:['goodluck']});
  }
  function insurance(id,r) {
    const pending=new Set(r.round.hands.map(h=>r.owners[h.box]));
    if([...pending].some(p=>!Object.hasOwn(r.insurance,p)))return;
    const before=structuredClone(r.round),takeBoxes=[];
    for(const h of r.round.hands)if(r.insurance[r.owners[h.box]])takeBoxes.push(h.box);
    r.round=move(r,'insurance',{takeBoxes}).round;
    for(const h of before.hands)if(takeBoxes.includes(h.box))amount(id,r.owners[h.box],-h.stake/2,'insurance',r.roundId);
    sequence(r,before);
  }
  function action(id,r,act) {
    const before=structuredClone(r.round),stake=r.round.hands[r.round.active].stake;
    r.round=move(r,'act',{action:act}).round;
    if(['double','split'].includes(act))amount(id,r.owners[before.hands[before.active].box],-stake,act,r.roundId);
    sequence(r,before,{prefix:act==='double'?['double']:[]});
  }
  function resetRound(r) {
    for(const [pid,keep] of Object.entries(r.boxesAfterRound??{}))for(const i of owned(r,pid))if(!keep.includes(i))r.owners[i]=null;
    r.boxesAfterRound={};
    // Kevin 24 Oct, "Table is full": (a) a box without a bet in the round that just ended is released (one taken during
    // the round stays); (b) while someone waits for a place (a viewer without a box at a full table, within WAITING_MS) a
    // player keeps at most MAX_BOXES_WHEN_WAITING boxes, the ones he played first. Nothing is taken from a round in play.
    if(r.round){const played=new Set(r.round.hands.map(h=>h.box));
      for(let i=0;i<7;i++)if(r.owners[i]&&!played.has(i)&&!(r.chosenInRound??[]).includes(i))r.owners[i]=null;
      if(Object.values(r.waiting??{}).some(t=>now()-t<WAITING_MS))for(const pid of new Set(r.owners.filter(Boolean))){
        const mine=owned(r,pid).sort((a,b)=>played.has(b)-played.has(a)||a-b);
        for(const i of mine.slice(MAX_BOXES_WHEN_WAITING))r.owners[i]=null;
      }}
    r.waiting={};r.chosenInRound=[];
    r.phase='bets';r.round=null;r.plan=null;r.waits=[];r.bets=emptyBets();r.ready=[];r.history={};r.deadline=null;r.insurance={};r.leaving=[];r.actionDeadline=null;
  }
  function releaseSeats(r,playerId) {
    for(const i of owned(r,playerId)){r.owners[i]=null;r.bets[i]={main:0,pp:0,tp:0};}
    r.ready=r.ready.filter(x=>x!==playerId);delete r.history[playerId];
    r.leaving=(r.leaving??[]).filter(x=>x!==playerId);r.version++;
    if(r.phase==='settled'&&!r.owners.some(Boolean))resetRound(r);
    if(r.phase==='bets'&&!r.bets.some(b=>b.main))r.deadline=null;
  }
  function advance(id,r) {
    const time=now();r.leaving??=[];
    // Kevin 24 Oct: "Table is full bugg a player is finished but reserverad all the table". Between rounds a player gone
    // 60 s (no page asking) gives up his boxes (a round still lets him go after 120 s, standing his hands); one whose page
    // is still open but who has neither bet nor acted for 90 s while the table bets gives them up too
    for(const p of players(id))if(time-p.seen>(r.phase==='round'?120000:60000)&&owned(r,p.id).length){
      if(r.phase==='round'){if(!r.leaving.includes(p.id)){r.leaving.push(p.id);r.version++;}}
      else releaseSeats(r,p.id);
    }
    if(r.phase==='bets'){r.lastAct??={};for(const pid of new Set(r.owners.filter(Boolean))){
      if(owned(r,pid).some(i=>r.bets[i]?.main))continue;
      r.lastAct[pid]??=time;if(time-r.lastAct[pid]>IDLE_SEAT_MS)releaseSeats(r,pid);
    }}
    if(r.phase==='bets')for(const p of players(id))if(pausedUntil(p.token)>time){
      for(const i of owned(r,p.id))r.bets[i]={main:0,pp:0,tp:0};
      r.ready=r.ready.filter(x=>x!==p.id);delete r.history[p.id];
    }
    if(r.phase==='bets'&&!r.bets.some(b=>b.main))r.deadline=null;
    if(r.phase==='bets'&&r.deadline&&time>=r.deadline)start(id,r);
    if(r.phase==='round'&&time>=r.plan.endAt) {
      if(r.round.phase==='settled') {
        for(const p of players(id)) {
          const hands=r.round.hands.filter(h=>r.owners[h.box]===p.id);
          if(!hands.length)continue;
          const returned=hands.reduce((n,h)=>n+h.result+h.sideReturn,0);
          const staked=hands.reduce((n,h)=>n+h.stake+h.pp+h.tp+(h.insured||0),0);
          const receipt={roundId:r.roundId??r.plan.id,settledAt:time,returned,staked,net:returned-staked,hands};
          db.prepare('INSERT INTO shared_settlements VALUES (?,?,?,?)').run(id,receipt.roundId,p.id,JSON.stringify(receipt));
          audit.event(id,r.roundId,'wallet.settlement',{playerId:p.id,name:p.name,...receipt});
          amount(id,p.id,returned,'payout',receipt.roundId);db.prepare('UPDATE shared_players SET last_return=? WHERE room=? AND id=?').run(returned,id,p.id);
        }
        move(r,'collect');r.phase='settled';r.version++;r.actionDeadline=null;
      } else if(r.round.phase==='insurance') {
        let changed=false;
        for(const owner of r.owners)if(owner&&!Object.hasOwn(r.insurance,owner)&&(time>=r.actionDeadline||r.leaving.includes(owner))){r.insurance[owner]=false;changed=true;}
        if(changed)insurance(id,r);
      } else if(time>=r.actionDeadline||r.leaving.includes(r.owners[r.round.hands[r.round.active]?.box]))action(id,r,'stand');
    }
    if(r.phase!=='round')for(const playerId of [...r.leaving])releaseSeats(r,playerId);
  }
  function view(id,r,token) {
    const L=limitsFor(id);
    const all=players(id),me=all.find(p=>p.token===token);
    const roster=all.filter(p=>owned(r,p.id).length).map(p=>({id:p.id,name:p.name,seats:owned(r,p.id),online:now()-p.seen<15000,ready:r.ready.includes(p.id)}));
    const insuranceDue=r.phase==='round'&&r.round?.phase==='insurance'&&me&&r.round.hands.some(h=>r.owners[h.box]===me.id)&&!Object.hasOwn(r.insurance,me.id);
    return {limits:{name:L.name,tableName:L.tableName??null,min:L.min,max:L.max,sideMax:L.sideMax,chips:L.chips,refill:L.balance},session:id,language:dealerLanguage(r.language),availableLanguages:languages,pausedUntil:pausedUntil(token),roundId:r.roundId??null,actionMs,version:r.version,serverNow:now(),demo:true,phase:r.phase,players:roster,owners:r.owners,bets:r.bets,round:r.round,shoe:gameView(r.game).shoe,plan:r.plan,waits:(r.waits??[]).filter(w=>!w.until||w.until>now()-2000),talk:(r.talk??[]).filter(t=>t.endAt>now()-2000),deadline:r.deadline,actionDeadline:r.actionDeadline,insuranceDue:Boolean(insuranceDue),me:me?{id:me.id,name:me.name,leaving:(r.leaving??[]).includes(me.id),balance:me.balance,seats:owned(r,me.id),boxesAfterRound:r.boxesAfterRound?.[me.id]??null,repeatable:Object.keys(r.lastBets?.[me.id]??{}).some(i=>owned(r,me.id).includes(Number(i))),lastReturn:me.last_return,lastSettlement:JSON.parse(db.prepare('SELECT receipt FROM shared_settlements WHERE room=? AND player_id=? ORDER BY rowid DESC LIMIT 1').get(id,me.id)?.receipt??'null')}:null};
  }
  function readGameState(room='astrid',token=null,displayName=null) {
    const id=sessionName(room),row=db.prepare('SELECT state FROM shared_rooms WHERE id=?').get(id);
    if(!row)return null;
    const r=JSON.parse(row.state);
    const cleanName=String(displayName??'').normalize('NFC').trim().replace(/\s+/g,' ').slice(0,18);
    const me=(token?player(id,keyFor(token)):null)??(cleanName?db.prepare('SELECT * FROM shared_players WHERE room=? AND name=? COLLATE NOCASE').get(id,cleanName):null);
    const dealing=Boolean(r.plan&&r.plan.endAt>now());
    const current=dealing?r.plan.before:r.round;
    const boxes=me?r.owners.flatMap((owner,i)=>owner===me.id?[i]:[]):[];
    const hands=(current?.hands??[]).filter(hand=>boxes.includes(hand.box)).map(hand=>({
      box:7-hand.box,   // shown box number, first base = 1 (public/box-label.js)
      cards:hand.cards.map(card=>String(card.r)),
      total:total(hand.cards),
    }));
    const phase=dealing?'dealing':current?.phase??(r.phase==='bets'?'betting':r.phase);
    const settled=!dealing&&phase==='settled';
    const dealerCards=(settled?current?.dealer??[]:(current?.dealer??[]).slice(0,1)).map(card=>String(card.r));
    const activeHand=phase==='decisions'?current?.hands?.[current.active]:null;
    return Object.freeze({
      phase,
      playerName:me?.name??null,
      boxes:boxes.map(box=>7-box),
      hands,
      dealerCards,
      dealerTotal:settled?total(current.dealer):null,
      activeBox:activeHand?7-activeHand.box:null,
      roundId:r.roundId??null,
    });
  }
  function run(token,input) {
    const id=sessionName(input.session),key=keyFor(token);let welcome;
    db.exec('BEGIN IMMEDIATE');
    try {
      const r=load(id);command(r.game,{op:'state'},0);
      let p=player(id,key);
      if(p)db.prepare('UPDATE shared_players SET seen=? WHERE room=? AND token=?').run(now(),id,key);
      advance(id,r);
      const op=input.op??'state';
      if(op!=='state') {
        if(typeof input.requestId!=='string'||!input.requestId||input.requestId.length>100)throw new Error('Request ID required');
        const previous=db.prepare('SELECT input FROM shared_requests WHERE room=? AND token=? AND id=?').get(id,key,input.requestId);
        if(previous){if(previous.input!==JSON.stringify(input))throw new Error('Request ID reused with different input');}
        else {
          const context=contexts.get(r);context.parent=audit.event(id,r.phase==='bets'?null:r.roundId,'player.'+op,{playerId:p?.id??null,name:p?.name??null,requestId:input.requestId,action:input.action??null,seat:input.seat??null,field:input.field??null,chip:input.chip??null,take:input.take??null});
          // Betting on separate owned boxes commutes. Only a hand decision needs
          // the exact snapshot; otherwise one guest could block another's chip.
          if(op==='act'&&input.version!==r.version)throw new Error('Table changed. Please try again');
          const paused=pausedUntil(key)>now();
          if(paused&&(['join','refill','bet','undo','doubleBets','allSeats','repeat','ready'].includes(op)||(op==='act'&&input.action!=='stand')||(op==='insurance'&&input.take)))throw new Error('Your demo break is active for 24 hours');
          if(op==='pause'){
            db.prepare('INSERT INTO demo_breaks VALUES (?,?) ON CONFLICT(token) DO UPDATE SET until_ms=MAX(until_ms,excluded.until_ms)').run(key,now()+86400000);
            for(const {id:other} of db.prepare('SELECT id FROM shared_rooms').all()){
              const room=other===id?r:load(other);advance(other,room);save(other,room);
            }
          } else if(op==='join') {
            if(p&&(r.leaving??[]).includes(p.id))throw new Error('Your current hand is finishing before you leave');
            const name=cleanPlayerName(input.name),seats=input.seats;
            if(!Array.isArray(seats)||!seats.length||seats.length>7||new Set(seats).size!==seats.length||seats.some(i=>!Number.isInteger(i)||i<0||i>6))throw new Error('Choose one or more boxes');
            if(seats.some(i=>r.owners[i]&&r.owners[i]!==p?.id))throw new Error('That box was just taken. Choose another');
            if(players(id).some(x=>x.id!==p?.id&&owned(r,x.id).length&&x.name.toLowerCase()===name.toLowerCase()))throw new Error('That name is already at this table');
            if(!p) {
              const previousWallet=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='demo_tables'").get();
              // A studio table opens with its preset's balance; only the original demo room carries a solo-wallet balance over.
              const L=limitsFor(id),balance=previousWallet&&!L.preset?db.prepare('SELECT balance FROM demo_tables WHERE session=?').get(key)?.balance??L.balance:L.balance;
              const uid=randomUUID();db.prepare('INSERT INTO shared_players VALUES (?,?,?,?,?,?,NULL)').run(id,key,uid,name,balance,now());p=player(id,key);transactions.record(id,p,null,'opening_credit',0,balance);welcome={session:id,name,text:personalizedGreeting(name,'en')};
            } else db.prepare('UPDATE shared_players SET name=? WHERE room=? AND token=?').run(name,id,key);
            // feedback #7: mid-round, a box that still holds a hand is released after the round, never refused
            const inPlay=new Set(r.phase==='bets'?[]:(r.round?.hands??[]).map(h=>h.box));
            const later=[];
            for(const i of owned(r,p.id))if(!seats.includes(i)){if(inPlay.has(i)){later.push(i);continue;}if(sum(r.bets[i]))throw new Error('Clear your bets before changing boxes');r.owners[i]=null;}
            r.boxesAfterRound??={};if(later.length)r.boxesAfterRound[p.id]=[...seats].sort();else delete r.boxesAfterRound[p.id];
            for(const i of seats)r.owners[i]=p.id;
            if(r.phase!=='bets')r.chosenInRound=[...new Set([...(r.chosenInRound??[]),...seats])];   // kept after the round (resetRound)
          } else {
            if(!p||!owned(r,p.id).length)throw new Error('Choose your boxes and enter your name first');
            if(r.leaving.includes(p.id)&&op!=='leave')throw new Error('Your current hand is finishing before you leave');
            // decisions open once the last card has landed (plan.turnAt); the next round waits for the whole plan
            const own=owned(r,p.id),busy=r.plan&&now()<r.plan.endAt,turnBusy=r.plan&&now()<(r.plan.turnAt??r.plan.endAt);
            if(op==='language') {
              if(!languages.includes(input.language))throw new Error('Choose an available dealer language');
              if(r.phase!=='bets'||r.bets.some(b=>sum(b)>0))throw new Error('Change dealer language before placing bets');
              r.language=input.language;
              audit.event(id,null,'presentation.language',{language:r.language,playerId:p.id},context.parent);
            }
            else if(op==='refill')amount(id,p.id,limitsFor(id).balance,'demo_refill');
            else if(op==='leave') {
              if(r.phase==='round'){if(!r.leaving.includes(p.id))r.leaving.push(p.id);advance(id,r);}
              else releaseSeats(r,p.id);
            } else if(['bet','undo','clear','doubleBets','allSeats','repeat'].includes(op)) {
              if(r.phase!=='bets')throw new Error('Betting is closed');
              if(r.ready.includes(p.id))throw new Error('You are ready for this round');
              const prior=structuredClone(r.bets),next=structuredClone(r.bets);
              if(op==='bet') {
                // CH: a seated player opens a free box by putting a main bet on it, as at a real table
                if(own.length&&!own.includes(input.seat)&&input.field==='main'&&Number.isInteger(input.seat)&&input.seat>=0&&input.seat<7&&!r.owners[input.seat]){r.owners[input.seat]=p.id;own.push(input.seat);}
                if(!own.includes(input.seat)||!['main','pp','tp'].includes(input.field))throw new Error('Choose one of your boxes');
                if(!limitsFor(id).chips.includes(input.chip))throw new Error('Choose a chip from this table');
                if(input.field!=='main'&&!next[input.seat].main)throw new Error('Place your bets please');
                next[input.seat][input.field]+=input.chip;
              } else if(op==='repeat') {
                // Repeat bet: last round's stakes back on the boxes this player still owns
                const last=Object.entries(r.lastBets?.[p.id]??{}).filter(([i])=>own.includes(Number(i)));
                if(!last.length)throw new Error('No previous bet to repeat');
                for(const [i,b] of last)next[i]={...b};
              } else if(op==='undo') {
                const old=r.history[p.id]?.pop();if(old)for(const i of own)next[i]=old[i];
              } else for(const i of own)for(const f of ['main','pp','tp']) {
                if(op==='clear')next[i][f]=0;
                if(op==='doubleBets')next[i][f]*=2;
                if(op==='allSeats'&&f==='main'){if(!limitsFor(id).chips.includes(input.chip))throw new Error('Choose a chip from this table');next[i].main+=input.chip;}
              }
              checkLimits(next,limitsFor(id));
              if(own.reduce((n,i)=>n+sum(next[i]),0)>p.balance)throw new Error('Insufficient demo balance');
              if(op!=='undo'){(r.history[p.id]??=[]).push(prior);r.history[p.id]=r.history[p.id].slice(-100);}
              r.bets=next;if(!r.deadline&&next.some(b=>b.main))r.deadline=now()+betMs;
              if(!next.some(b=>b.main))r.deadline=null;
            } else if(op==='ready') {
              if(r.phase!=='bets'||!own.some(i=>r.bets[i].main))throw new Error('Place your bets please');
              if(!r.ready.includes(p.id))r.ready.push(p.id);
              const seated=players(id).filter(x=>owned(r,x.id).length&&now()-x.seen<15000);
              if(seated.every(x=>r.ready.includes(x.id)))start(id,r);
            } else if(op==='act') {
              if(turnBusy||r.phase!=='round'||r.round.phase!=='decisions')throw new Error('Wait for your turn');
              const h=r.round.hands[r.round.active];if(r.owners[h.box]!==p.id)throw new Error('It is another player’s turn');
              if(['double','split'].includes(input.action)&&h.stake>p.balance)throw new Error('Insufficient demo balance');
              action(id,r,input.action);
            } else if(op==='insurance') {
              if(turnBusy||r.phase!=='round'||r.round.phase!=='insurance'||typeof input.take!=='boolean'||Object.hasOwn(r.insurance,p.id)||!r.round.hands.some(h=>own.includes(h.box)))throw new Error('Insurance is not available');
              const cost=r.round.hands.filter(h=>own.includes(h.box)).reduce((n,h)=>n+h.stake/2,0);
              if(input.take&&cost>p.balance)throw new Error('Insufficient demo balance');
              r.insurance[p.id]=input.take;insurance(id,r);
            } else if(op==='next') {
              if(r.phase!=='settled'||busy)throw new Error('The round is still in progress');
              resetRound(r);
            } else throw new Error('Unknown table command');
          }
          r.version++;db.prepare('INSERT INTO shared_requests VALUES (?,?,?,?)').run(id,key,input.requestId,JSON.stringify(input));
        }
      }
      if(op!=='state'){const me=player(id,key);if(me){r.lastAct??={};r.lastAct[me.id]=now();}}   // idle seats: advance()
      else{const me=player(id,key);if(!(me&&owned(r,me.id).length)&&r.owners.every(Boolean))(r.waiting??={})[key.slice(0,16)]=now();}   // waits for a place (resetRound)
      save(id,r);const snapshot=view(id,r,key);db.exec('COMMIT');
      if(welcome)Promise.resolve().then(()=>onWelcome(welcome)).catch(()=>{});
      return snapshot;
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  function tick(){for(const {id} of db.prepare('SELECT id FROM shared_rooms').all()){if(quiet.has(id))continue;
    db.exec('BEGIN IMMEDIATE');try{const r=load(id);advance(id,r);save(id,r);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');}
  }}
  // snapshot: a visitor without a guest cookie (not seated yet) sees the table as a guest.
  /**
   * An answer spoken over whatever the dealer shows (rorlig-lipsync.mjs), at once, on the table clock (Emil 12 Oct: she
   * answers mid-deal, not after the last card). Only a line already speaking goes first; a recorded line still to come
   * moves after the answer (a late good luck is dropped). → {talk, moved (lines with a new time), steg, ready}.
   */
  // an answer starts this long after it is made: Dragan's first lip-synced patch takes 1.15–1.3 s (staging 13 Oct)
  const ANSWER_LEAD=1600;
  function addTalk(session,input) {
    const id=sessionName(session);
    db.exec('BEGIN IMMEDIATE');
    try{
      const r=load(id),t=now(),live=(r.talk??[]).filter(x=>x.endAt>t),tid=randomUUID();
      const speaking=live.filter(x=>x.startAt<=t+ANSWER_LEAD);
      const start=Math.round(Math.max(t+ANSWER_LEAD,input.notBefore??0,...speaking.map(x=>x.endAt+250)));
      const {notBefore,...said}=input;
      const ready=readyFor(id),steg=[...(r.prevSteps??[]),...(r.plan?.steps??[])],talker=ready?talkFor(id):null;   // talkFor: the hook (talk below is the answer)
      const talk=withIdle(r,ready,{id:tid,kind:'answer',...said,startAt:start,endAt:Math.round(start+input.dur*1000),kartaStart:start-LJUD_FORE*1000,flex:false,...(said.kind==='line'?{}:{ljud:`/api/lip/${tid}/ljud`})},steg,talker);   // a recorded line (kind line) is fetched by its clip, an answer's voice from /api/lip
      let free=talk.endAt+250;const later=[],moved=[];
      for(const x of live.filter(x=>!speaking.includes(x)).sort((a,b)=>a.startAt-b.startAt)){
        if(x.startAt>=free){later.push(x);continue;}
        if(x.kind==='line'&&x.event==='goodluck')continue;
        const d=x.endAt-x.startAt,{idle:_,chain:__,...rest}=x,y=withIdle(r,ready,{...rest,startAt:free,endAt:free+d,kartaStart:free-LJUD_FORE*1000},steg,talker,[...speaking,talk,...later]);
        later.push(y);moved.push(y);free=y.endAt+250;
      }
      r.talk=[...speaking,talk,...later];r.talkUntil=Math.max(r.talkUntil??0,...r.talk.map(x=>x.endAt+250));
      save(id,r);db.exec('COMMIT');
      return{talk,moved,steg,ready};
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  return{run,tick,readGameState,addTalk,hasRoom:room=>Boolean(db.prepare('SELECT 1 FROM shared_rooms WHERE id=?').get(String(room).toLowerCase())),language:session=>load(sessionName(session)).language,snapshot:(session,token)=>{const id=sessionName(session);return view(id,load(id),token?keyFor(token):null);},presentationContext:(room='astrid')=>{
    const row=db.prepare('SELECT state FROM shared_rooms WHERE id=?').get(sessionName(room));
    const r=row?JSON.parse(row.state):null;
    return {room,language:dealerLanguage(r?.language),roundId:r?.roundId??null,parent:db.prepare('SELECT seq FROM audit_events WHERE room=? ORDER BY seq DESC LIMIT 1').get(room)?.seq??null,sessionRevision:String(r?.version??0),roundRevision:`${r?.roundId??'none'}:${r?.version??0}`,phase:r?.plan&&r.plan.endAt>now()?'dealing':r?.round?.phase??r?.phase??'idle'};
  },recordSpeechDecision:record=>{
    if(!record.room)return;
    const payload=Object.fromEntries(['requestId','decision','responseId','sessionRevision','roundRevision'].map(k=>[k,String(record[k]??'').slice(0,128)]));
    audit.event(sessionName(record.room),record.roundId??null,'presentation.speech_choice',payload,record.parent??null);
  },backoffice:(input={})=>input.view==='workspace'?{...readBackofficeWorkspace(db,now),manifest}:input.view==='operations'?readOperations(db,now):input.view==='transactions'?transactions.read(input):audit.read(input),paused:token=>pausedUntil(keyFor(token))>now(),close:()=>db.close()};
}
