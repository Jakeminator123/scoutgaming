// Randomized idle cadence for the green waiting clip. Pure: no DOM, no timers.
// Base loops repeat; after a base hold of 1-3 loops a glance is drawn with the
// configured probability, never twice in a row and never later than maxBaseRun
// base loops after the previous glance. Every segment starts and ends on a
// ready-pose frame, so any order splices.
export function mulberry32(seed){
  let a=seed>>>0;
  return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}

export function createIdleScheduler({segments,random=Math.random,glanceProbability=.4,maxBaseRun=3,holdLoops=[1,3],glances=['glanceLeft','glanceRight','full']}={}){
  const names=Object.keys(segments??{});
  if(!names.includes('base'))throw new Error('Idle scheduler needs a base segment');
  const options=glances.filter(name=>names.includes(name));
  if(!options.length)throw new Error('Idle scheduler needs at least one glance segment');
  const randInt=(lo,hi)=>lo+Math.floor(random()*(hi-lo+1));
  // The player always opens with one base loop before asking for the next segment.
  let baseRun=1,hold=0,lastWasGlance=false;
  return {
    next(){
      if(lastWasGlance){lastWasGlance=false;hold=randInt(holdLoops[0],holdLoops[1])-1;baseRun=1;return 'base';}
      if(hold>0){hold--;baseRun++;return 'base';}
      if(baseRun>=maxBaseRun||random()<glanceProbability){
        lastWasGlance=true;baseRun=0;return options[Math.floor(random()*options.length)];
      }
      baseRun++;return 'base';
    },
    isGlance:name=>name!=='base',
  };
}

// Segments must start and end on ready-pose frames so any order splices.
export function idleSegmentErrors(take){
  const errors=[],ready=new Set(take?.readyFrames??[]);
  for(const [name,s] of Object.entries(take?.segments??{})){
    if(!Number.isInteger(s?.start)||!Number.isInteger(s?.end)||s.start>=s.end)errors.push(`${name}: invalid range`);
    else{
      if(!ready.has(s.start))errors.push(`${name}: start ${s.start} is not a ready-pose frame`);
      if(!ready.has(s.end))errors.push(`${name}: end ${s.end} is not a ready-pose frame`);
      if(s.end>=take.frames)errors.push(`${name}: end ${s.end} beyond ${take.frames} frames`);
    }
  }
  if(!take?.segments?.base)errors.push('base segment missing');
  return errors;
}

// The only legal cut inside a running segment is its end frame.
export function interruptFrame(segment){return segment.end;}
