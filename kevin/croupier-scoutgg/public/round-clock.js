// Presentation clock for this private demo. Commands still go through the
// server's legality/version checks. A hidden page never spends decision time.
export function createRoundClock({now=()=>performance.now(),seconds=20,onExpire=()=>{}}={}) {
  let key=null, deadline=0, remaining=0, paused=false, expired=false;
  return {
    set(nextKey) {
      if(nextKey===key)return;
      key=nextKey;remaining=nextKey?seconds*1000:0;deadline=now()+remaining;expired=false;
    },
    pause(value) {
      if(paused===value)return;
      if(value)remaining=Math.max(0,deadline-now());else deadline=now()+remaining;
      paused=value;
    },
    tick() {
      if(!key)return null;
      const ms=paused?remaining:Math.max(0,deadline-now());
      const result={key,seconds:Math.ceil(ms/1000),fraction:ms/(seconds*1000),paused,expired:ms===0};
      if(!paused && ms===0 && !expired){expired=true;onExpire(key);}
      return result;
    },
  };
}
