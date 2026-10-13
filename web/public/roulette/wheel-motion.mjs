// Presentation only: the caller supplies the server outcome's index in WHEEL.
export const SPIN_MS=9000;
export const TAU=Math.PI*2;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
const speed=x=>30*x*x*(1-x)*(1-x);
const wrap=x=>((x%TAU)+TAU)%TAU;
export function createSpin(pocketIndex,startRotation=0) {
  if(!Number.isInteger(pocketIndex)||pocketIndex<0||pocketIndex>36||!Number.isFinite(startRotation))throw Error('invalid_wheel_target');
  const pocket=-Math.PI/2+pocketIndex*TAU/37;
  const delta=TAU*4+wrap(Math.PI/2-pocket-startRotation);
  const rotor=t=>startRotation+delta*smooth(t);
  const capture=.80,release=.54,span=capture-release;
  const launch=-Math.PI/4,travel=TAU*5;
  const begin=launch-travel*release;
  const target=begin-wrap(begin-(rotor(capture)+pocket))-TAU;
  const endSpeed=delta*speed(capture);
  return progress=>{
    const t=clamp(progress),rotation=rotor(t);
    let angle;
    if(t<release)angle=launch-travel*t;
    else if(t<capture){
      const u=(t-release)/span,u2=u*u,u3=u2*u;
      angle=(2*u3-3*u2+1)*begin+(u3-2*u2+u)*(-travel*span)+(-2*u3+3*u2)*target+(u3-u2)*(endSpeed*span);
    }else angle=target+rotation-rotor(capture);
    const drop=smooth((t-.57)/(.80-.57));
    const radius=196+(107-196)*drop;
    return {rotation,angle,radius,x:848+radius*Math.cos(angle),y:461+19*drop+radius*.315*Math.sin(angle),settled:t===1};
  };
}
