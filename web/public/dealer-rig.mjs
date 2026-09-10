import * as T from './vendor/three/three.module.js';
import {solveArm,sampleTwoHandDelivery,sampleCardAction,ease} from './dealer-motion.mjs';

// Uses the imported skin weights and skeleton. Never substitutes a rigid cutout.
export function controlDealer(root,profile) {
  const bones=new Map();root.traverse(o=>{if(o.isBone)bones.set(o.name,o);if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const rest=new Map([...bones].map(([name,b])=>[name,{q:b.quaternion.clone(),p:b.position.clone()}]));
  function bone(key){const b=bones.get(profile.bones[key]);if(!b)throw new Error(`Missing dealer joint: ${key}`);return b;}
  const arms={};
  const legs={};
  for(const side of ['left','right']){
    const upper=bone(side+'UpperArm'),lower=bone(side+'ForeArm'),hand=bone(side+'Hand');
    root.updateMatrixWorld(true);
    const a=upper.getWorldPosition(new T.Vector3()),b=lower.getWorldPosition(new T.Vector3()),c=hand.getWorldPosition(new T.Vector3());
    const forward=c.clone().sub(b).normalize();
    const normal=new T.Vector3(0,0,1).addScaledVector(forward,-forward.z).normalize();
    const across=new T.Vector3().crossVectors(forward,normal).normalize();
    const from=new T.Matrix4().makeBasis(across,forward,normal);
    const to=new T.Matrix4().makeBasis(new T.Vector3(1,0,0),new T.Vector3(0,0,1),new T.Vector3(0,-1,0));
    const flat=new T.Quaternion().setFromRotationMatrix(to.multiply(from.invert())).multiply(hand.getWorldQuaternion(new T.Quaternion()));
    arms[side]={upper,lower,hand,l1:a.distanceTo(b),l2:b.distanceTo(c),flat};
    const prefix=side[0].toUpperCase()+side.slice(1),thigh=bones.get(prefix+'UpLeg'),shin=bones.get(prefix+'Leg'),foot=bones.get(prefix+'Foot');
    if(thigh&&shin&&foot){const h=thigh.getWorldPosition(new T.Vector3()),k=shin.getWorldPosition(new T.Vector3()),f=foot.getWorldPosition(new T.Vector3());legs[side]={thigh,shin,foot,l1:h.distanceTo(k),l2:k.distanceTo(f),rest:f.clone(),q:foot.getWorldQuaternion(new T.Quaternion())};}
  }
  const v=arr=>new T.Vector3(...arr);
  function aim(joint,child,target){
    root.updateMatrixWorld(true);
    const from=child.getWorldPosition(new T.Vector3()).sub(joint.getWorldPosition(new T.Vector3())).normalize();
    const to=target.clone().sub(joint.getWorldPosition(new T.Vector3())).normalize();
    const world=joint.getWorldQuaternion(new T.Quaternion());
    world.premultiply(new T.Quaternion().setFromUnitVectors(from,to));
    const parent=joint.parent.getWorldQuaternion(new T.Quaternion()).invert();
    joint.quaternion.copy(parent.multiply(world));root.updateMatrixWorld(true);
  }
  function reset(){for(const [name,b] of bones){b.quaternion.copy(rest.get(name).q);b.position.copy(rest.get(name).p);}root.updateMatrixWorld(true);}
  function reach(side,target){
    const arm=arms[side],shoulder=arm.upper.getWorldPosition(new T.Vector3());
    const pole=shoulder.clone().add(new T.Vector3(side==='left'?.035:-.035,-.32,-.15));
    const s=solveArm(shoulder.toArray(),target,arm.l1,arm.l2,pole.toArray());
    aim(arm.upper,arm.lower,v(s.elbow));aim(arm.lower,arm.hand,v(s.wrist));
    return s.error;
  }
  function orientHand(side,quaternion){
    const hand=arms[side].hand;
    hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(quaternion));
    root.updateMatrixWorld(true);
  }
  return {root,bones,arms,reset,reach,orientHand,bone,
    flattenHand(side,direction=[0,0,1]){const yaw=Math.atan2(direction[0],direction[2]);orientHand(side,arms[side].flat.clone().premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw)));},
    plantFeet(){const errors={};for(const [side,leg] of Object.entries(legs)){const h=leg.thigh.getWorldPosition(new T.Vector3()),pole=h.clone().add(new T.Vector3(0,-.3,.3)),s=solveArm(h.toArray(),leg.rest.toArray(),leg.l1,leg.l2,pole.toArray());aim(leg.thigh,leg.shin,new T.Vector3(...s.elbow));aim(leg.shin,leg.foot,new T.Vector3(...s.wrist));leg.foot.quaternion.copy(leg.foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(leg.q));errors[side]=s.error;}root.updateMatrixWorld(true);return errors;},
    lean(angle,lateral=0){const spine=bones.get('Spine02');if(!spine)return;const q=spine.getWorldQuaternion(new T.Quaternion());q.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),angle));q.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),lateral));spine.quaternion.copy(spine.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));root.updateMatrixWorld(true);},
    raiseGaze(angle){const head=bone('head'),q=head.getWorldQuaternion(new T.Quaternion());q.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-angle));head.quaternion.copy(head.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));root.updateMatrixWorld(true);},
    curl(side,amount){for(const name of profile.bones.fingers?.[side]??[]){const b=bones.get(name);if(b)b.quaternion.copy(rest.get(name).q).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),amount*(name.includes('Thumb')?.35:1)));}root.updateMatrixWorld(true);},
    contactPoint(side){const prefix=side[0].toUpperCase()+side.slice(1),tip=bones.get(prefix+'Index3'),middle=bones.get(prefix+'Index2');if(!tip||!middle)throw new Error('Finger contact requires index joints');const p=tip.getWorldPosition(new T.Vector3()),m=middle.getWorldPosition(new T.Vector3());return p.add(p.clone().sub(m).multiplyScalar(.7));},
    contactOffset(side){return this.contactPoint(side).sub(this.handPosition(side));},
    handPosition(side){return arms[side].hand.getWorldPosition(new T.Vector3());},
    diagnostics(){return {bones:bones.size,arms:Object.fromEntries(Object.entries(arms).map(([k,a])=>[k,{upper:a.l1,lower:a.l2}]))};},
  };
}

export function poseDealer(rig,progress,target,outlet) {
  const sample=sampleTwoHandDelivery(progress,{outlet,target});rig.reset();
  const reachWeight=progress<.2?0:progress<.69?ease((progress-.2)/.49):1-ease((progress-.75)/.25);
  rig.root.position.set(.095+(target[0]*.28-.095)*reachWeight,-.030-.025*reachWeight,0);
  rig.root.updateMatrixWorld(true);rig.lean(.4+.45*reachWeight,-target[0]*.22*reachWeight);rig.raiseGaze(.28+.34*reachWeight);const footErrors=rig.plantFeet();
  const errors={};sample.contacts={};
  for(const side of ['left','right']){
    const handoff=target[0]<0?ease((progress-.24)/.12)*(1-ease((progress-.40)/.14)):0;
    const point=[...sample[side]],sign=side==='left'?1:-1;
    point[0]+=sign*.025*handoff;sample.contacts[side]=point;
    const direction=[(point[0]-rig.root.position.x)*(1-handoff)-sign*.20*handoff,0,Math.max(.25,point[2])],grip=sample[side+'Grip'];
    rig.flattenHand(side,direction);rig.curl(side,grip*.24);
    const wrist=new T.Vector3(...point).sub(rig.contactOffset(side)).add(new T.Vector3(0,.003,0)).toArray();
    errors[side]=rig.reach(side,wrist);rig.flattenHand(side,direction);rig.curl(side,grip*.24);
  }
  // Card local +Z follows the hand's radial direction. Freeze at release.
  const contactX=sample.released?target[0]:sample.card[0];
  const contactZ=sample.released?target[2]:sample.card[2];
  const bodyX=sample.released?target[0]*.28:rig.root.position.x;
  sample.cardYaw=Math.atan2(contactX-bodyX,Math.max(.25,contactZ));
  return {sample,errors,footErrors,fingerError:rig.contactPoint(sample.active).distanceTo(new T.Vector3(...sample.contacts[sample.active]))};
}


// Choreography candidates: consume authoritative card positions, never issue cards.
export function poseCardAction(rig,progress,options) {
  const sample=sampleCardAction(progress,options),t=Math.max(0,Math.min(1,progress));
  rig.reset();
  const weight=ease(t/.2)*(1-ease((t-.75)/.25));
  const bodyTarget=sample.hand;
  rig.root.position.set(.095+(bodyTarget[0]*.28-.095)*weight,-.030-.040*weight,0);
  rig.root.updateMatrixWorld(true);const bend=Math.min(.45,Math.max(Math.abs(bodyTarget[0])*.40,bodyTarget[2]*.70));rig.lean(.4+bend*weight,-bodyTarget[0]*.22*weight);rig.raiseGaze(.28+bend*.75*weight);
  const footErrors=rig.plantFeet(),errors={};sample.contacts={};
  const handoff=options.kind==='collect'&&options.source[0]>0&&options.target[0]<0?ease((t-.24)/.12)*(1-ease((t-.40)/.14)):0;
  for(const side of ['left','right']){
    const sign=side==='left'?1:-1,point=[...sample[side]];
    point[0]+=sign*.025*handoff;
    const direction=[(point[0]-rig.root.position.x)*(1-handoff)-sign*.20*handoff,0,Math.max(.25,point[2])];
    // A bounded wrist roll accompanies the lifted reveal; the rigid card turns fully.
    const roll=options.kind==='reveal'&&side==='right'&&sample.picked&&!sample.released?.48*Math.sin(sample.cardPitch):0;
    function orient(){rig.flattenHand(side,direction);if(roll){const q=rig.arms[side].hand.getWorldQuaternion(new T.Quaternion());q.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),roll));rig.orientHand(side,q);}rig.curl(side,sample[side+'Grip']*.24);}
    orient();sample.contacts[side]=point;
    errors[side]=rig.reach(side,new T.Vector3(...point).sub(rig.contactOffset(side)).add(new T.Vector3(0,.003,0)).toArray());orient();
  }
  return {sample,errors,footErrors,fingerError:rig.contactPoint(sample.active).distanceTo(new T.Vector3(...sample.contacts[sample.active]))};
}


export function poseDealerGesture(rig,progress,{kind='greeting'}={}) {
  if(!['greeting','accept-bets'].includes(kind))throw new Error('Unknown dealer gesture');
  const t=Math.max(0,Math.min(1,progress)),w=ease(t/.28)*(1-ease((t-.72)/.28));
  const base=poseDealer(rig,0,[0,.91055,.23],[.56,.935,.11]);
  rig.raiseGaze(-.12*Math.sin(Math.PI*t)*Math.sin(Math.PI*t));
  if(kind==='greeting'){
    const idleQ=rig.arms.right.hand.getWorldQuaternion(new T.Quaternion());
    const start=rig.handPosition('right'),goal=new T.Vector3(-.38,1.30,.10),point=start.lerp(goal,w);
    base.errors.right=rig.reach('right',point.toArray());
    const raised=rig.arms.right.flat.clone().premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI*.5));
    const q=idleQ.slerp(raised,w);
    q.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),Math.sin(t*Math.PI*6)*.16*w));
    rig.orientHand('right',q);rig.curl('right',.06*w);
  }
  base.sample={kind,phase:kind,active:'right',picked:false,released:false};base.fingerError=0;
  return base;
}
