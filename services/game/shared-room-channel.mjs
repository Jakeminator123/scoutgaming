/** Read-only transport adapter, not a WebSocket listener. Ports must return the reviewed
 * coordinator snapshot / K04 current projection, never raw room, audit or shoe state.
 * authorize(request,{roomId}) and revalidate(binding,{signal}) return the same fixed
 * server binding {actorId,sessionId,operatorId,roomId,packageRevision,expiresAt}.
 * Commit hints only request fresh reads; this module never acknowledges an outbox,
 * changes presence, or persists a receiver version. A client still gates presentation replay.
 * origin is the allowed browser/UI origin. The future listener must validate its own
 * configured engine host and ingress before prepare; forwarded-host headers are not trusted.
 */
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
const eventShapes = {
  speak:fields('type line blocking family'),idle:fields('type family'),
  deal:{...fields('type to box handIndex faceDown shoeDraw family'),card,clip:fields('action prefer fallback')},
  reveal:{...fields('type to shoeDraw family'),card},
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
    return project(event,eventShapes[event.type]);
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
export function createSharedRoomChannel({origin,authorize,revalidate,readSnapshot,readPresentation,now=Date.now,
  readTimeoutMs=2000,maxBufferedBytes=256*1024,maxReadAttempts=3,maxConnections=128,consistencyTimeoutMs=10000}={}) {
  let parsed;try{parsed=new URL(origin);}catch{fail();}
  if(parsed.origin!==origin||!['https:','http:'].includes(parsed.protocol)
    ||![authorize,revalidate,readSnapshot,readPresentation,now].every(port=>typeof port==='function')
    ||!Number.isSafeInteger(readTimeoutMs)||readTimeoutMs<1||readTimeoutMs>30000
    ||!Number.isSafeInteger(consistencyTimeoutMs)||consistencyTimeoutMs<1||consistencyTimeoutMs>30000
    ||!Number.isSafeInteger(maxBufferedBytes)||maxBufferedBytes<256||maxBufferedBytes>1024*1024
    ||!Number.isSafeInteger(maxReadAttempts)||maxReadAttempts<1||maxReadAttempts>5
    ||!Number.isSafeInteger(maxConnections)||maxConnections<1||maxConnections>10000)fail();
  const rooms=new Map(),connections=new Set();let stopped=false;
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
      let closed=false,running=false,dirty=false,generation=0,expiryTimer,operation,consistencyTimer;
      let sentVersion=-1,sentPresentation=-1;
      const cleanup=()=>{
        if(closed)return;closed=true;clearTimeout(expiryTimer);clearTimeout(consistencyTimer);operation?.abort();
        socket.off('message',inbound);socket.off('close',cleanup);socket.off('error',broken);
        connections.delete(connection);const group=rooms.get(roomId);group?.delete(connection);if(!group?.size)rooms.delete(roomId);
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
                // Wait for that receiver's next hint, with one bounded timer;
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
      const connection={close,requestRefresh};
      connections.add(connection);if(!rooms.has(roomId))rooms.set(roomId,new Set());rooms.get(roomId).add(connection);
      socket.on('message',inbound);socket.on('close',cleanup);socket.on('error',broken);
      expire();requestRefresh();return Object.freeze({close});
    }});
  }
  return Object.freeze({prepare,
    emitCommitted(roomId){if(!id(roomId))fail('shared_room_request_rejected',400);for(const connection of rooms.get(roomId)??[])connection.requestRefresh();},
    close(){if(stopped)return;stopped=true;for(const connection of [...connections])connection.close();}
  });
}
