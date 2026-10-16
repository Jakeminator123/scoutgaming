// From Jakob's scoutgaming main (web/public/roulette/wheel-motion.mjs, 87f30ce), unchanged: presentation only.
// Presentation only: the caller supplies the server outcome's index in WHEEL.
export const SPIN_MS=9000;
export const TAU=Math.PI*2;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
const speed=x=>30*x*x*(1-x)*(1-x);
const wrap=x=>((x%TAU)+TAU)%TAU;
// Stable presentation choices from the public round ID, never the winning number.
export function presentationForRound(roundId='') {
  let seed=2166136261;
  for(const char of String(roundId))seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
  seed=Math.imul(seed^(seed>>>16),0x85ebca6b)>>>0;
  seed=Math.imul(seed^(seed>>>13),0xc2b2ae35)>>>0;seed=(seed^(seed>>>16))>>>0;
  return {
    // Keep the final ball outside the narrow area hidden by the brass spindle.
    stopAngle:-Math.PI/2+.32+(TAU-.64)*(seed/4294967296),
    duration:8500+seed%3501,rotorTurns:3+(seed>>>8)%3,ballTurns:5+(seed>>>16)%3,
  };
}
export function createSpin(pocketIndex,startRotation=0,{stopAngle=Math.PI/2,rotorTurns=4,ballTurns=5,ballDelay=0}={}) {
  if(!Number.isInteger(pocketIndex)||pocketIndex<0||pocketIndex>36||!Number.isFinite(startRotation))throw Error('invalid_wheel_target');
  if(!Number.isFinite(stopAngle)||!Number.isInteger(rotorTurns)||rotorTurns<1||rotorTurns>8||!Number.isInteger(ballTurns)||ballTurns<1||ballTurns>10)throw Error('invalid_wheel_motion');
  if(!Number.isFinite(ballDelay)||ballDelay<0||ballDelay>.5)throw Error('invalid_ball_delay');
  const pocket=-Math.PI/2+pocketIndex*TAU/37;
  const delta=TAU*rotorTurns+wrap(stopAngle-pocket-startRotation);
  const rotor=t=>startRotation+delta*smooth(t);
  const capture=ballDelay+(1-ballDelay)*.80,release=ballDelay+(1-ballDelay)*.54,span=capture-release;
  const launch=-Math.PI/4,travel=TAU*ballTurns;
  const begin=launch-travel*.54;
  const target=begin-wrap(begin-(rotor(capture)+pocket))-TAU;
  const endSpeed=delta*speed(capture);
  return progress=>{
    const t=clamp(progress),rotation=rotor(t);
    let angle;
    if(t<release)angle=launch-travel*clamp((t-ballDelay)/(1-ballDelay));
    else if(t<capture){
      const u=(t-release)/span,u2=u*u,u3=u2*u;
      angle=(2*u3-3*u2+1)*begin+(u3-2*u2+u)*(-travel*span/(1-ballDelay))+(-2*u3+3*u2)*target+(u3-u2)*(endSpeed*span);
    }else angle=target+rotation-rotor(capture);
    const drop=smooth(((t-ballDelay)/(1-ballDelay)-.57)/(.80-.57));
    const radius=196+(107-196)*drop;
    return {rotation,angle,radius,x:848+radius*Math.cos(angle),y:461+19*drop+radius*.315*Math.sin(angle),visible:t>=ballDelay,settled:t===1};
  };
}
