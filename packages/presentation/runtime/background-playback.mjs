import {validateBackgroundPlayback} from '../../../packages/presentation/contracts/background-playback-policy.mjs';

const WINDOW_MS=60000;
// Silent presentation-only scheduling. Callbacks never own dealer, speech,
// cards or wallet work. Admission reserves time before starting any media IO.
export function createBackgroundPlayback(policy,{now=()=>performance.now(),onStart=()=>{},onStop=()=>{},
  setTimeout:schedule=globalThis.setTimeout,clearTimeout:cancel=globalThis.clearTimeout}={}) {
  const rules=validateBackgroundPlayback(policy).rules;
  if([now,onStart,onStop,schedule,cancel].some(value=>typeof value!=='function'))throw Error('Invalid background playback callbacks');
  let running=false,closed=false,active=null,serial=0,timer=null,lastTime=-Infinity;
  const history=new Map(rules.map(rule=>[rule.id,[]])),lastStart=new Map(),due=new Map(),seen=new Set();
  const time=()=>{const value=now();if(!Number.isFinite(value)||value<0||value<lastTime)throw Error('Invalid background playback clock');lastTime=value;return value;};
  function prune(rule,at) {
    const records=history.get(rule.id).filter(record=>record.end>at-WINDOW_MS||record.start>at-WINDOW_MS);
    history.set(rule.id,records);return records;
  }
  function eligible(rule,at) {
    const records=prune(rule,at);
    if(at-(lastStart.get(rule.id)??-Infinity)<rule.cooldownMs
      ||records.filter(record=>record.start>at-WINDOW_MS).length>=rule.maxPerMinute)return false;
    const proposed={start:at,end:at+rule.maxDurationMs},all=[...records,proposed];
    // Window occupancy is piecewise linear. Check every slope-change point,
    // including future windows: expiring a start alone must not refund seconds
    // from a long clip that still overlap the rolling minute.
    const points=[at,proposed.end,...all.flatMap(record=>[record.start,record.end,record.start+WINDOW_MS,record.end+WINDOW_MS])];
    return points.filter(end=>end>=at&&end<=proposed.end+WINDOW_MS).every(end=>
      all.reduce((sum,record)=>sum+Math.max(0,Math.min(end,record.end)-Math.max(end-WINDOW_MS,record.start)),0)<=rule.maxSecondsPerMinute*1000);
  }
  function stop(reason,at) {
    if(!active)return;
    const old=active;active=null;old.record.end=Math.min(old.record.end,at);
    try{onStop(old.token,reason);}catch{/* A decorative stop cannot block its owner. */}
  }
  function arm(at) {
    if(timer!==null)cancel(timer);timer=null;if(closed)return;
    const next=Math.min(active?.deadline??Infinity,...(running?[...due.values()]:[]));
    if(Number.isFinite(next))timer=schedule(tick,Math.max(0,next-at));
  }
  function admit(rule,kind,at) {
    if(closed||active&&(kind==='automatic'||active.kind!=='automatic')||!eligible(rule,at))return false;
    if(active)stop('event-priority',at);
    const token=++serial,record={start:at,end:at+rule.maxDurationMs};
    history.get(rule.id).push(record);lastStart.set(rule.id,at);
    active={token,rule,kind,record,deadline:record.end};arm(at);
    try{const result=onStart(structuredClone(rule),token);if(result?.then)Promise.resolve(result).catch(()=>finish(token,'error'));}
    catch{finish(token,'error');}
    return true;
  }
  function tick() {
    timer=null;const at=time();if(closed)return;
    const endedNow=Boolean(active&&active.deadline<=at);
    if(endedNow)stop('duration',at);
    if(running)for(const rule of rules)if(due.has(rule.id)&&due.get(rule.id)<=at){
      due.set(rule.id,at+rule.trigger.everyMs);
      // Missed or busy opportunities are dropped, never queued for a burst.
      if(!active&&!endedNow)admit(rule,'automatic',at);
    }
    arm(at);
  }
  function finish(token,reason='ended') {
    const at=time();if(closed||active?.token!==token)return false;
    stop(reason,at);arm(at);return true;
  }
  return Object.freeze({
    start(){const at=time();if(closed||running)return;running=true;
      for(const rule of rules)if('everyMs'in rule.trigger)due.set(rule.id,at+rule.trigger.everyMs);arm(at);},
    pause(){const at=time();if(closed)return;running=false;due.clear();stop('paused',at);arm(at);},
    event(eventId,eventKey){const at=time();if(closed||!running||typeof eventId!=='string')return false;
      if(eventKey!==undefined){if(typeof eventKey!=='string'||!eventKey||eventKey.length>256)return false;
        const key=eventId+':'+eventKey;if(seen.has(key))return false;seen.add(key);if(seen.size>128)seen.delete(seen.values().next().value);}
      const rule=rules.find(rule=>rule.trigger.eventId===eventId&&eligible(rule,at));
      return Boolean(rule&&admit(rule,'event',at));},
    // Manual Studio testing uses the same reservations even while automation
    // is paused; it does not start automation or another playback channel.
    preview(ruleId){const at=time(),rule=rules.find(rule=>rule.id===ruleId);return Boolean(!closed&&rule&&admit(rule,'preview',at));},
    finish,
    close(){const at=time();if(closed)return;running=false;due.clear();stop('closed',at);closed=true;if(timer!==null)cancel(timer);timer=null;seen.clear();},
  });
}
