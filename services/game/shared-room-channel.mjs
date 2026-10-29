/** Read-only transport adapter, not a WebSocket listener. Ports must return the reviewed
 * coordinator snapshot / K04 current projection, never raw room, audit or shoe state.
 * authorize(request,{roomId}) and revalidate(binding,{signal}) return the same fixed
 * server binding {actorId,sessionId,operatorId,roomId,packageRevision,expiresAt}.
 * Commit hints only request fresh reads; this module never acknowledges an outbox or
 * persists a receiver version. A client still gates presentation replay.
 * Overlap (F11): observeRoom(roomId,{version,presentationVer}) carries the committed room
 * versions the runtime's pass read anyway; a socket that has sent less rereads once. That
 * covers commits by another engine instance (Render deploy/restart), whose hints never
 * arrive here. close() is the SIGTERM path: every socket gets 1012 shared_room_restart.
 * Presence (B4): an optional touch(binding,{signal}) port marks the bound player as seen
 * in the bound room when a socket attaches and then once per presenceIntervalMs while it
 * stays open, after the same revalidation as a read. It is never a game or wallet
 * command; one touch at a time per socket, no touch after close.
 * origin is the allowed browser/UI origin. The future listener must validate its own
 * configured engine host and ingress before prepare; forwarded-host headers are not trusted.
 */
/** Chat text never carries control (except \n), bidi override/isolate/mark or zero-width characters. */
export const unsafeChatText=/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/;
const fail = (code='shared_room_unavailable',statusCode=503) => { throw Object.assign(new Error(code),{code,statusCode}); };
const id = value => typeof value==='string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value>=0;
const object = value => value && Object.getPrototypeOf(value)===Object.prototype;
const fields = names => Object.fromEntries(names.split(' ').map(key=>[key,true]));
const list = (each,limit=32) => ({each,limit});
const card = fields('r s shoeDraw');
const side = {...fields('stake returned profit label'),draws:list(true,3)};
const hand = {...fields('box splitFrom stake pp tp done doubled insured result sideReturn busted'),cards:list(card),sideLabels:list(true,4),sideResults:{pp:side,tp:side}};
const snapshotShape = {
  ...fields('contract roomId version configVersion windowId phase roundId turnSeq presentationVer deadline actionDeadline serverNow unopened'),
  settings:{...fields('configVersion language betMs actionMs refill'),limits:fields('min max sideMax'),chips:list(true,64)},
  owners:list(true,7),seatGen:list(true,7),bets:list(fields('main pp tp'),7),
  plan:fields('id startAt endAt turnAt'),
  round:{...fields('phase active holeDraw'),boxes:list(hand,7),hands:list(hand,28),dealer:list(card),legalActions:list(true,8)},
  shoe:fields('id total remaining dealt cutAfter cutReached commitment shufflePending decks burn'),
  players:list({...fields('id ready leaving online'),seats:list(true,7)},7),
  me:{...fields('id memberGen active available pausedUntil insuranceDue'),seats:list(true,7),
    lastSettlement:{...fields('roundId settledAt returned staked net'),hands:list(hand,28)}}
};
// K04 F5c: a filmed step's server choice (shared-room-filmed-steps.mjs); never a card.
const clipRef = fields('id sha256');
const filmed = {filmedTake:fields('profileId takeKey id sha256'),filmedTransitions:{before:clipRef,after:clipRef}};
// Speech lag (28 Oct 2026): a spoken line's standard clip (shared-room-filmed-steps.mjs withSpeechTakes).
const eventShapes = {
  speak:{...fields('type line blocking family'),speechTake:clipRef},idle:fields('type family'),
  deal:{...fields('type to box handIndex faceDown shoeDraw family'),card,clip:fields('action prefer fallback'),...filmed},
  reveal:{...fields('type to shoeDraw family'),card,...filmed},
  settle:{...fields('type dealerTotal dealerBlackjack'),hands:list(fields('box stake returned outcome'),28)},
  turn:{...fields('type box handIndex'),legalActions:list(true,8)}
};
// Select only explicit public fields at every level. Unknown/private properties are
// not traversed, serialized, or spread into a message; scalar/array bounds also apply.
function project(value,shape) {
  if(value===null)return null;
  if(shape===true) {
    if(typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&value.length<=256)return value;
    fail();
  }
  if(shape.each) {
    if(!Array.isArray(value)||value.length>shape.limit)fail();
    return value.map(item=>project(item,shape.each));
  }
  if(!object(value))fail();
  return Object.fromEntries(Object.entries(shape).filter(([key])=>Object.hasOwn(value,key)&&value[key]!==undefined).map(([key,child])=>[key,project(value[key],child)]));
}
export function projectSharedRoomSnapshot(rawSnapshot,binding) {
  const s=project(rawSnapshot,snapshotShape);
  if(!s||s.contract!=='blackjack-table/1'||s.roomId!==binding.roomId||s.me?.id!==binding.actorId
    ||!integer(s.version)||!integer(s.presentationVer)||!id(s.configVersion)||!id(s.windowId))fail();
  if(s.unopened!==undefined&&typeof s.unopened!=='boolean')fail();
  if(s.settings!==undefined) {
    const cfg=s.settings,positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
    if(!object(cfg)||cfg.configVersion!==s.configVersion||!['en','sv'].includes(cfg.language)
      ||!Number.isSafeInteger(cfg.betMs)||cfg.betMs<=0||!Number.isSafeInteger(cfg.actionMs)||cfg.actionMs<=0
      ||!cfg.limits||!positive(cfg.limits.min)||!positive(cfg.limits.max)||cfg.limits.max<cfg.limits.min
      ||typeof cfg.limits.sideMax!=='number'||!Number.isFinite(cfg.limits.sideMax)||cfg.limits.sideMax<0
      ||!positive(cfg.refill)||!Array.isArray(cfg.chips)||cfg.chips.length===0
      ||!cfg.chips.every(positive)||new Set(cfg.chips).size!==cfg.chips.length)fail();
  }
  if(s.round&&s.round.phase!=='settled'&&s.round.holeDraw!=null
    &&s.round.dealer?.some(c=>c.shoeDraw===s.round.holeDraw))fail();
  return s;
}
function publicPair(rawSnapshot,rawPresentation,binding) {
  const s=projectSharedRoomSnapshot(rawSnapshot,binding);
  if(rawPresentation===null)return {snapshot:s,presentation:null,consistent:s.presentationVer===0};
  const p=project(rawPresentation,{...fields('roomId ver talkId auditSeq kind status windowId configVersion language startAt endAt'),lines:list(fields('index line lineId'),128)});
  if(!p||p.roomId!==binding.roomId||!integer(p.ver)||!id(p.talkId)||!integer(p.auditSeq)
    ||!['ready','legacy'].includes(p.status)||!Array.isArray(rawPresentation.events)||rawPresentation.events.length>128)fail();
  p.events=rawPresentation.events.map(event=>{
    if(!object(event)||!Object.hasOwn(eventShapes,event.type))fail();
    if(event.type==='deal'&&event.faceDown===true&&event.card!==null)fail();
    const value=project(event,eventShapes[event.type]),take=value.filmedTake,moves=value.filmedTransitions;
    const sha=ref=>typeof ref?.sha256==='string'&&/^[a-f0-9]{64}$/.test(ref.sha256)&&id(ref.id);
    if(take!==undefined&&(!sha(take)||!id(take.profileId)||!id(take.takeKey)))fail();
    if(moves!==undefined&&(take===undefined||!object(moves)||['before','after'].some(key=>moves[key]!==null&&!sha(moves[key]))))fail();
    if(value.speechTake!==undefined&&!sha(value.speechTake))fail();
    return value;
  });
  if(!Array.isArray(p.lines))fail();
  if(p.status==='legacy') {
    if(p.kind!==null||p.events.length||p.lines.length)fail();
  } else if(!['plan','collect','window'].includes(p.kind)||!['en','sv'].includes(p.language)
    ||!id(p.configVersion)||!id(p.windowId)||!Number.isFinite(p.startAt)||!Number.isFinite(p.endAt)||p.endAt<p.startAt)fail();
  if(p.ver===s.presentationVer&&p.status==='ready'&&(p.configVersion!==s.configVersion||p.windowId!==s.windowId))fail();
  for(const line of p.lines)if(!integer(line.index)||p.events[line.index]?.type!=='speak'
    ||p.events[line.index].line!==line.line||!/^[a-f0-9]{32}$/.test(line.lineId))fail();
  return {snapshot:s,presentation:p,consistent:p.ver===s.presentationVer};
}
const bindingKeys=['actorId','sessionId','operatorId','roomId','packageRevision','expiresAt'];
function bind(value,roomId,now) {
  if(!object(value)||!bindingKeys.every(key=>Object.hasOwn(value,key))
    ||!['actorId','sessionId','operatorId','roomId'].every(key=>id(value[key]))||value.roomId!==roomId
    ||!Number.isSafeInteger(value.packageRevision)||value.packageRevision<1||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=now())fail('shared_room_unauthorized',403);
  return Object.freeze(Object.fromEntries(bindingKeys.map(key=>[key,value[key]])));
}
function bounded(work,controller,timeoutMs) {
  let cancel,timer;
  const aborted=new Promise((_,reject)=>{
    cancel=()=>reject(Object.assign(Error('shared_room_read_cancelled'),{code:'shared_room_read_cancelled'}));
    controller.signal.addEventListener('abort',cancel,{once:true});
    timer=setTimeout(()=>controller.abort(),timeoutMs);
    if(controller.signal.aborted)cancel();
  });
  const task=Promise.resolve().then(()=>{if(controller.signal.aborted)fail();return work(controller.signal);});
  // Cleanup follows the race, even when a broken port never settles after abort.
  return Promise.race([task,aborted]).finally(()=>{clearTimeout(timer);controller.signal.removeEventListener('abort',cancel);});
}
export function createSharedRoomChannel({origin,authorize,revalidate,readSnapshot,readPresentation,touch,now=Date.now,
  readTimeoutMs=2000,maxBufferedBytes=256*1024,maxReadAttempts=3,maxConnections=128,consistencyTimeoutMs=10000,
  presenceIntervalMs=10000,observeRetryMs=1000,chatLimit=30}={}) {
  let parsed;try{parsed=new URL(origin);}catch{fail();}
  if(parsed.origin!==origin||!['https:','http:'].includes(parsed.protocol)
    ||![authorize,revalidate,readSnapshot,readPresentation,now].every(port=>typeof port==='function')
    ||!Number.isSafeInteger(readTimeoutMs)||readTimeoutMs<1||readTimeoutMs>30000
    ||!Number.isSafeInteger(consistencyTimeoutMs)||consistencyTimeoutMs<1||consistencyTimeoutMs>30000
    ||!Number.isSafeInteger(maxBufferedBytes)||maxBufferedBytes<256||maxBufferedBytes>1024*1024
    ||!Number.isSafeInteger(maxReadAttempts)||maxReadAttempts<1||maxReadAttempts>5
    ||!Number.isSafeInteger(maxConnections)||maxConnections<1||maxConnections>10000
    ||touch!==undefined&&typeof touch!=='function'
    ||!Number.isSafeInteger(presenceIntervalMs)||presenceIntervalMs<1||presenceIntervalMs>60000
    ||!Number.isSafeInteger(observeRetryMs)||observeRetryMs<1||observeRetryMs>30000
    ||!Number.isSafeInteger(chatLimit)||chatLimit<1||chatLimit>200)fail();
  const rooms=new Map(),actors=new Map(),connections=new Set(),chats=new Map();let stopped=false;
  async function prepare(request) {
    if(stopped)fail();
    const header=request?.headers?.get?.bind(request.headers);
    if(request?.method!=='GET'||!header||header('origin')!==origin)fail('shared_room_request_rejected',403);
    let url;try{url=new URL(request.url);}catch{fail('shared_room_request_rejected',403);}
    const roomId=url.pathname.slice('/shared-room/'.length);
    // The browser Origin can differ from the engine host. The listener owns its
    // transport host; this adapter owns the exact browser origin and room path.
    if(url.username||url.password||url.search||url.hash||!url.pathname.startsWith('/shared-room/')
      ||!id(roomId)||request.url!==url.origin+'/shared-room/'+roomId)fail('shared_room_request_rejected',403);
    const binding=bind(await bounded(signal=>authorize(request,{roomId,signal}),new AbortController(),readTimeoutMs),roomId,now);
    let used=false;
    return Object.freeze({attach(socket) {
      if(used||stopped)fail();used=true;
      if(!socket||!['on','off','send','close'].every(key=>typeof socket[key]==='function')||socket.readyState!==1)fail();
      if(binding.expiresAt<=now()){socket.close(1008,'shared_room_unauthorized');fail('shared_room_unauthorized',403);}
      if(connections.size>=maxConnections){socket.close(1013,'shared_room_capacity');fail();}
      let closed=false,running=false,dirty=false,generation=0,expiryTimer,operation,consistencyTimer,presenceTimer,presence;
      let sentVersion=-1,sentPresentation=-1,observed=null;
      const cleanup=()=>{
        if(closed)return;closed=true;clearTimeout(expiryTimer);clearTimeout(consistencyTimer);clearTimeout(presenceTimer);
        operation?.abort();presence?.abort();
        socket.off('message',inbound);socket.off('close',cleanup);socket.off('error',broken);
        connections.delete(connection);const group=rooms.get(roomId);group?.delete(connection);
        // The last socket out takes the room's chat with it: the next company starts empty.
        if(!group?.size){rooms.delete(roomId);chats.delete(roomId);}
        const own=actors.get(binding.actorId);own?.delete(connection);if(!own?.size)actors.delete(binding.actorId);
      };
      const close=(code=1000,reason='shared_room_closed')=>{if(closed)return;cleanup();try{socket.close(code,reason);}catch{}};
      const inbound=()=>close(1008,'shared_room_read_only'),broken=()=>close(1011,'shared_room_unavailable');
      const expire=()=>{if(binding.expiresAt<=now())close(1008,'shared_room_unauthorized');
        else {expiryTimer=setTimeout(expire,Math.min(2147483647,binding.expiresAt-now()));expiryTimer.unref?.();}};
      const check=async signal=>{
        const current=bind(await revalidate(binding,{signal}),roomId,now);
        if(!bindingKeys.every(key=>current[key]===binding[key]))fail('shared_room_unauthorized',403);
      };
      async function refresh() {
        if(closed||running)return;running=true;let mismatches=0;
        try {
          while(dirty&&!closed) {
            dirty=false;const observed=generation;operation=new AbortController();
            const pair=await bounded(async signal=>{
              await check(signal);
              if(closed||signal.aborted)fail();
              const [snapshot,presentation]=await Promise.all([readSnapshot(roomId,binding.actorId,{signal}),readPresentation(roomId,{signal})]);
              if(closed||signal.aborted)fail();
              const projected=publicPair(snapshot,presentation,binding);
              await check(signal);return projected;
            },operation,readTimeoutMs);
            operation=null;if(closed)return;
            if(observed!==generation){dirty=true;continue;}
            if(pair.snapshot.version<sentVersion||pair.snapshot.presentationVer<sentPresentation) {
              if(++mismatches>=maxReadAttempts)fail();dirty=true;continue;
            }
            if(!pair.consistent) {
              if(++mismatches>=maxReadAttempts) {
                // Game state can commit before its outbox reaches the receiver.
                // Wait for that receiver's next hint (or, from another instance, the
                // runtime's next observation, observeRetryMs), with one bounded timer;
                // never poll SQL in a loop or send a mixed-version frame.
                if(!consistencyTimer) {
                  consistencyTimer=setTimeout(()=>close(1011,'shared_room_unavailable'),consistencyTimeoutMs);
                  consistencyTimer.unref?.();
                }
                break;
              }
              dirty=true;continue;
            }
            clearTimeout(consistencyTimer);consistencyTimer=undefined;
            if(binding.expiresAt<=now())fail('shared_room_unauthorized',403);
            const data=JSON.stringify({type:'shared-room-state',roomId,snapshot:pair.snapshot,presentation:pair.presentation});
            if(socket.readyState!==1||!Number.isFinite(socket.bufferedAmount)||socket.bufferedAmount<0
              ||socket.bufferedAmount+Buffer.byteLength(data)>maxBufferedBytes){close(1013,'shared_room_backpressure');return;}
            socket.send(data,error=>{if(error)broken();});
            sentVersion=pair.snapshot.version;sentPresentation=pair.snapshot.presentationVer;mismatches=0;
          }
        } catch(error) {if(!closed)close(error?.statusCode===403?1008:1011,error?.statusCode===403?'shared_room_unauthorized':'shared_room_unavailable');}
        finally {running=false;operation=null;}
      }
      const requestRefresh=()=>{if(closed)return;generation++;dirty=true;if(!running)queueMicrotask(refresh);};
      // F11: committed room versions seen by the runtime's own pass, which also covers a commit
      // by another engine instance. Behind what this socket has sent -> one ordinary reread
      // (same revalidation, projection and consistency gate). Never while a read is pending;
      // the same unchanged observation retries at most once per observeRetryMs (a receiver
      // that has not caught up yet), so an observation never becomes a read loop.
      const observe=(version,presentationVer)=>{
        if(closed||running||dirty||version<=sentVersion&&presentationVer<=sentPresentation)return;
        const at=now();
        if(observed&&observed.version===version&&observed.presentationVer===presentationVer&&at-observed.at<observeRetryMs)return;
        observed={version,presentationVer,at};requestRefresh();
      };
      // The next touch is armed only after the previous one settled: at most one per interval.
      async function beat() {
        if(closed||!touch)return;presence=new AbortController();
        try {
          await bounded(async signal=>{await check(signal);if(closed||signal.aborted)fail();await touch(binding,{signal});},presence,readTimeoutMs);
        } catch(error) {
          // A revoked session closes like a read; a missed touch only ages presence.
          if(!closed&&error?.statusCode===403){close(1008,'shared_room_unauthorized');return;}
        } finally {presence=null;}
        if(!closed){presenceTimer=setTimeout(beat,presenceIntervalMs);presenceTimer.unref?.();}
      }
      // Chat (PR 1): server -> client only. who is per socket; the actor id never leaves the server.
      const chat=entry=>{
        if(closed)return;
        const data=JSON.stringify({type:'shared-room-chat',roomId,lineId:entry.lineId,requestId:entry.requestId,
          who:entry.actorId===null?'dealer':entry.actorId===binding.actorId?'you':'player',seat:entry.seat,text:entry.text,at:entry.at});
        if(socket.readyState!==1||!Number.isFinite(socket.bufferedAmount)||socket.bufferedAmount<0
          ||socket.bufferedAmount+Buffer.byteLength(data)>maxBufferedBytes){close(1013,'shared_room_backpressure');return;}
        socket.send(data,error=>{if(error)broken();});
      };
      const connection={close,requestRefresh,observe,roomId,chat};
      connections.add(connection);if(!rooms.has(roomId))rooms.set(roomId,new Set());rooms.get(roomId).add(connection);
      if(!actors.has(binding.actorId))actors.set(binding.actorId,new Set());actors.get(binding.actorId).add(connection);
      socket.on('message',inbound);socket.on('close',cleanup);socket.on('error',broken);
      expire();requestRefresh();void beat();for(const entry of chats.get(roomId)??[])chat(entry);return Object.freeze({close});
    }});
  }
  return Object.freeze({prepare,
    emitCommitted(roomId){if(!id(roomId))fail('shared_room_request_rejected',400);for(const connection of rooms.get(roomId)??[])connection.requestRefresh();},
    // Private invalidation only: every connection rereads its own authorized
    // room through the same before/after revalidation and projection path.
    emitActorsCommitted(actorIds,{exceptRoom}={}){
      if(!Array.isArray(actorIds)||actorIds.some(actor=>typeof actor!=='string'||!actor)
        ||exceptRoom!==undefined&&!id(exceptRoom))fail('shared_room_request_rejected',400);
      for(const actor of new Set(actorIds))for(const connection of actors.get(actor)??[])
        if(connection.roomId!==exceptRoom)connection.requestRefresh();
    },
    // F11: {version,presentationVer} as committed in the store, from the runtime pass. Only
    // sockets in that room that have sent less reread; a room without sockets costs nothing.
    observeRoom(roomId,{version,presentationVer}={}){
      if(!id(roomId)||!integer(version)||!integer(presentationVer))fail('shared_room_request_rejected',400);
      for(const connection of rooms.get(roomId)??[])connection.observe(version,presentationVer);
    },
    // Chat (PR 1): the last chatLimit lines per room live in memory only (no DB). A socket
    // attaching later gets them first. actorId null is the dealer; seat is 1-7 or null. lineId is
    // the server's own row id (q-/a-<hex>); clients deduplicate on it, never on requestId.
    // A room without sockets keeps no log, and its log goes when its last socket closes.
    emitChat(roomId,{lineId,requestId,actorId,seat,text,at}={}){
      if(stopped)return;
      if(!id(roomId)||typeof lineId!=='string'||!/^[qa]-[0-9a-f]{24}$/.test(lineId)||!id(requestId)||actorId!==null&&!id(actorId)
        ||seat!==null&&!(Number.isSafeInteger(seat)&&seat>=1&&seat<=7)
        ||typeof text!=='string'||!text.trim()||text.length>1000||unsafeChatText.test(text)||!integer(at))fail('shared_room_request_rejected',400);
      const group=rooms.get(roomId);if(!group?.size)return;
      const entry=Object.freeze({lineId,requestId,actorId,seat,text,at}),log=chats.get(roomId)??[];
      log.push(entry);if(log.length>chatLimit)log.splice(0,log.length-chatLimit);chats.set(roomId,log);
      for(const connection of group)connection.chat(entry);
    },
    // B2: the service closes only on shutdown/restart (SIGTERM). 1012 tells the client to
    // reconnect with a fresh authenticated snapshot; 1000 would stop it for good.
    close(){if(stopped)return;stopped=true;chats.clear();for(const connection of [...connections])connection.close(1012,'shared_room_restart');}
  });
}
