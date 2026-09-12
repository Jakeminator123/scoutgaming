// PRIVATE Sept12 diagnostic: rejected V1 geometry; no appearance approval.
import * as T from '../../../../web/public/vendor/three/three.module.js';
import {solveArm,sampleTwoHandDelivery,sampleCardAction,ease} from '../../../../web/public/dealer-motion.mjs';

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
  const skinSets={left:[],right:[]};
  root.updateMatrixWorld(true);
  root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
    for(const side of ['left','right']){const prefix=side[0].toUpperCase()+side.slice(1),hand=[],finger=[],thumb=[];
      for(let i=0;i<indices.count;i++){let hw=0,fw=0,tw=0;for(let j=0;j<4;j++){const name=mesh.skeleton.bones[indices.getComponent(i,j)]?.name??'',w=weights.getComponent(i,j);if(name===prefix+'Hand'||(profile.bones.fingers?.[side]??[]).includes(name))hw+=w;if((profile.bones.fingers?.[side]??[]).includes(name)&&!name.includes('Thumb')&&/[23]$/.test(name))fw+=w;if(name.startsWith(prefix+'Thumb'))tw+=w;}if(hw>.5)hand.push(i);if(fw>.65)finger.push(i);if(tw>.5)thumb.push(i);}
      if(hand.length&&finger.length)skinSets[side].push({mesh,hand,finger,thumb});
    }
  });
  function skinPoint(mesh,index){const attrs=mesh.geometry.attributes,p=new T.Vector3().fromBufferAttribute(attrs.position,index).applyMatrix4(mesh.bindMatrix),result=new T.Vector3(),matrices=mesh.skeleton.boneMatrices;
    for(let j=0;j<4;j++){const w=attrs.skinWeight.getComponent(index,j);if(!w)continue;const k=attrs.skinIndex.getComponent(index,j)*16;result.x+=(matrices[k]*p.x+matrices[k+4]*p.y+matrices[k+8]*p.z+matrices[k+12])*w;result.y+=(matrices[k+1]*p.x+matrices[k+5]*p.y+matrices[k+9]*p.z+matrices[k+13])*w;result.z+=(matrices[k+2]*p.x+matrices[k+6]*p.y+matrices[k+10]*p.z+matrices[k+14])*w;}
    return result.applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(mesh.matrixWorld);
  }
  // Whole-hand support for this rejected diagnostic rig: fingertip-only masks miss palm skin.
  function skinContact(side){
    let lowest=null;
    for(const set of skinSets[side]){set.mesh.skeleton.update();for(const index of set.hand){const p=skinPoint(set.mesh,index);if(!lowest||p.y<lowest.y)lowest=p;}}
    if(!lowest)throw new Error('Actual skinned hand geometry is required for dealer support');return lowest;
  }
  function handLowest(side){let result=null;for(const set of skinSets[side]){set.mesh.skeleton.update();for(const index of set.hand){const point=skinPoint(set.mesh,index);if(!result||point.y<result.point.y){const ids=set.mesh.geometry.attributes.skinIndex,weights=set.mesh.geometry.attributes.skinWeight;result={point,index,bones:Array.from({length:4},(_,j)=>[set.mesh.skeleton.bones[ids.getComponent(index,j)].name,weights.getComponent(index,j)])};}}}return result;}
  function handFloor(side){return handLowest(side).point.y;}
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
    const pole=shoulder.clone().add(new T.Vector3(side==='left'?.10:-.10,-.32,-.10));
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
    flattenHand(side,direction=[0,0,1]){const yaw=Math.atan2(direction[0],direction[2]);orientHand(side,arms[side].flat.clone().premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.15)).premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw)));},
    plantFeet(){const errors={};for(const [side,leg] of Object.entries(legs)){const h=leg.thigh.getWorldPosition(new T.Vector3()),pole=h.clone().add(new T.Vector3(0,-.3,.3)),s=solveArm(h.toArray(),leg.rest.toArray(),leg.l1,leg.l2,pole.toArray());aim(leg.thigh,leg.shin,new T.Vector3(...s.elbow));aim(leg.shin,leg.foot,new T.Vector3(...s.wrist));leg.foot.quaternion.copy(leg.foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(leg.q));errors[side]=s.error;}root.updateMatrixWorld(true);return errors;},
    lean(angle,lateral=0){const spine=bones.get('Spine02');if(!spine)return;const q=spine.getWorldQuaternion(new T.Quaternion());q.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),angle));q.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),lateral));spine.quaternion.copy(spine.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));root.updateMatrixWorld(true);},
    raiseGaze(angle){const head=bone('head'),q=head.getWorldQuaternion(new T.Quaternion());q.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-angle));head.quaternion.copy(head.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));root.updateMatrixWorld(true);},
    curl(side,amount){for(const name of profile.bones.fingers?.[side]??[]){const b=bones.get(name);if(b)b.quaternion.copy(rest.get(name).q).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),amount*(name.includes('Thumb')?.35:1)));}root.updateMatrixWorld(true);},
    levelThumb(side){const prefix=side[0].toUpperCase()+side.slice(1),joint=bones.get(prefix+'Thumb1'),tip=bones.get(prefix+'Thumb3');if(!joint||!tip)return;
      for(let step=0;step<2;step++){const floor=skinContact(side).y;let lowest=Infinity;for(const set of skinSets[side])for(const index of set.thumb)lowest=Math.min(lowest,skinPoint(set.mesh,index).y);if(lowest>=floor+.0003)break;const target=tip.getWorldPosition(new T.Vector3());target.y+=floor-lowest+.0006;aim(joint,tip,target);}
    },
    contactPoint:skinContact,
    handFloor,handLowest,
    verifySkinMath(){let worst=0;for(const sets of Object.values(skinSets))for(const set of sets){set.mesh.skeleton.update();for(let j=0;j<set.hand.length;j+=Math.max(1,Math.floor(set.hand.length/16))){const index=set.hand[j],reference=new T.Vector3().fromBufferAttribute(set.mesh.geometry.attributes.position,index);set.mesh.applyBoneTransform(index,reference);set.mesh.localToWorld(reference);worst=Math.max(worst,reference.distanceTo(skinPoint(set.mesh,index)));}}return worst;},
    contactOffset(side){return this.contactPoint(side).sub(this.handPosition(side));},
    handPosition(side){return arms[side].hand.getWorldPosition(new T.Vector3());},
    diagnostics(){return {bones:bones.size,arms:Object.fromEntries(Object.entries(arms).map(([k,a])=>[k,{upper:a.l1,lower:a.l2}]))};},
  };
}

export function poseDealer(rig,progress,target,outlet) {
  const sample=sampleTwoHandDelivery(progress,{outlet,target});rig.reset();
  const reachWeight=progress<.2?0:progress<.69?ease((progress-.2)/.49):1-ease((progress-.75)/.25);
  const activity=progress<.2?ease(progress/.2):progress>.75?1-ease((progress-.75)/.25):1;
  rig.root.position.set((.095+(target[0]*.28-.095)*reachWeight)*activity,-.12+(.09-.025*reachWeight)*activity,0);
  rig.root.updateMatrixWorld(true);rig.lean(.05+(.35+.45*reachWeight)*activity,-target[0]*.22*reachWeight);rig.raiseGaze(.05+(.35+.33*reachWeight)*activity);const footErrors=rig.plantFeet();
  const errors={};sample.contacts={};
  for(const side of ['left','right']){
    const handoff=target[0]<0?ease((progress-.24)/.12)*(1-ease((progress-.40)/.14)):0;
    const point=[...sample[side]],sign=side==='left'?1:-1;
    point[0]+=sign*.025*handoff;sample.contacts[side]=point;
    const direction=[(point[0]-rig.root.position.x)*(1-handoff)-sign*.20*handoff,0,Math.max(.25,point[2])],grip=sample[side+'Grip'];
    rig.flattenHand(side,direction);rig.curl(side,grip*.03);rig.levelThumb(side);
    const wrist=new T.Vector3(...point).sub(rig.contactOffset(side)).add(new T.Vector3(0,.0007,0)).toArray();
    errors[side]=rig.reach(side,wrist);rig.flattenHand(side,direction);rig.curl(side,grip*.03);rig.levelThumb(side);
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
  const sample=options.sample??sampleCardAction(progress,options),t=Math.max(0,Math.min(1,progress));
  rig.reset();
  const weight=sample.bodyWeight??ease(t/.2)*(1-ease((t-.75)/.25));
  const bodyTarget=sample.hand;
  const activity=ease(t/.2)*(1-ease((t-.75)/.25));
  rig.root.position.set((.095+(bodyTarget[0]*.28-.095)*weight)*activity,-.12+(.09-.040*weight)*activity,0);
  rig.root.updateMatrixWorld(true);const bend=Math.min(.45,Math.max(Math.abs(bodyTarget[0])*.40,bodyTarget[2]*.70));rig.lean(.05+(.35+bend*weight)*activity,-bodyTarget[0]*.22*weight);rig.raiseGaze(.05+(.35+bend*.75*weight)*activity);
  const footErrors=rig.plantFeet(),errors={};sample.contacts={};
  const handoff=sample.handoff??(options.kind==='collect'&&options.source[0]>0&&options.target[0]<0?ease((t-.24)/.12)*(1-ease((t-.40)/.14)):0);
  for(const side of ['left','right']){
    const sign=side==='left'?1:-1,point=[...sample[side]];
    point[0]+=sign*.025*handoff;
    const direction=[(point[0]-rig.root.position.x)*(1-handoff)-sign*.20*handoff,0,Math.max(.25,point[2])];
    // A bounded wrist roll accompanies the lifted reveal; the rigid card turns fully.
    const roll=options.kind==='reveal'&&side==='right'&&sample.picked&&!sample.released?.48*Math.sin(sample.cardPitch):0;
    function orient(){rig.flattenHand(side,direction);if(roll){const q=rig.arms[side].hand.getWorldQuaternion(new T.Quaternion());q.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),roll));rig.orientHand(side,q);}rig.curl(side,sample[side+'Grip']*.03);rig.levelThumb(side);}
    orient();sample.contacts[side]=point;
    errors[side]=rig.reach(side,new T.Vector3(...point).sub(rig.contactOffset(side)).add(new T.Vector3(0,.0007,0)).toArray());orient();
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
