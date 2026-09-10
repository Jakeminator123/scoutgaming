import fs from 'node:fs';
import path from 'node:path';
import * as T from '../web/public/vendor/three/three.module.js';
import {controlDealer,poseDealer,poseCardAction,poseDealerGesture} from '../web/public/dealer-rig.mjs';
import {seatTarget} from '../web/public/dealer-motion.mjs';
const dir=process.argv[2];if(!dir)throw new Error('Pass prepared rig directory');
const bytes=fs.readFileSync(path.join(dir,'astrid-rigged.glb'));
const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
const joints=new Set(json.skins.flatMap(s=>s.joints)),nodes=json.nodes.map((n,i)=>{const o=joints.has(i)?new T.Bone():new T.Group();o.name=n.name??`node${i}`;if(n.matrix){o.matrix.fromArray(n.matrix);o.matrix.decompose(o.position,o.quaternion,o.scale);}else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});
json.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));const root=new T.Group();for(const i of json.scenes[json.scene??0].nodes)root.add(nodes[i]);root.updateMatrixWorld(true);
const profile=JSON.parse(fs.readFileSync(path.join(dir,'profile.json'))),rig=controlDealer(root,profile);
const rest=Object.fromEntries([...rig.bones].map(([name,b])=>[name,b.matrixWorld.toArray()]));
const samples=[],summary=[];
const tableProfile=JSON.parse(fs.readFileSync(new URL('../web/public/assets/blackjack-3d/profile.json',import.meta.url)));
const actions=[...Array.from({length:7},(_,seat)=>({name:`Deal_Seat_${String(seat+1).padStart(2,'0')}_Contact_Study`,kind:'deal',target:seatTarget(seat),seconds:1.65})),
 {name:'Deal_Own_Card_Contact_Study',kind:'deal',target:[0,.91055,.23],seconds:1.65},
 {name:'Reveal_Hole_Card_Study',kind:'reveal',source:[0,.91055,.23],target:[0,.91055,.23],seconds:1.8},
 {name:'Collect_Card_Study',kind:'collect',source:seatTarget(3),target:[-.91,.920,.25],seconds:2},
 {name:'Greeting_Wave_Study',kind:'greeting',seconds:1.65},
 {name:'Accept_Bets_Nod_Study',kind:'accept-bets',seconds:1.65}];
for(const [seat,action] of actions.entries()){
 let worst=0,contact=0,feet=0;const lastFrame=Math.round(action.seconds*30);
 for(let f=0;f<=lastFrame;f++){
  const p=f/lastFrame,result=action.kind==='deal'?poseDealer(rig,p,action.target,tableProfile.outlet):['reveal','collect'].includes(action.kind)?poseCardAction(rig,p,action):poseDealerGesture(rig,p,action);
  const {sample,errors,footErrors,fingerError}=result;
  feet=Math.max(feet,...Object.values(footErrors));
  worst=Math.max(worst,errors[sample.active]);if(sample.picked&&!sample.released)contact=Math.max(contact,fingerError);
  samples.push({frame:f+1,seat,action:action.name,progress:p,phase:sample.phase,card:sample.card,cardPitch:sample.cardPitch,cardYaw:sample.cardYaw,bones:Object.fromEntries([...rig.bones].map(([name,b])=>[name,b.matrixWorld.toArray()]))});
 }
 summary.push({action:action.name,maxActiveWristErrorMm:Math.round(worst*10000)/10,maxCarryFingerErrorMm:Math.round(contact*10000)/10,maxAnkleErrorMm:Math.round(feet*10000)/10});
}
const collectionCoverage=[];
for(let seat=0;seat<7;seat++){
 let wrist=0,ankle=0;
 for(let f=0;f<=100;f++){const r=poseCardAction(rig,f/100,{kind:'collect',source:seatTarget(seat),target:[-.91,.920,.25]});wrist=Math.max(wrist,r.errors[r.sample.active]);ankle=Math.max(ankle,...Object.values(r.footErrors));}
 collectionCoverage.push({seat:seat+1,wristErrorMm:wrist*1000,ankleErrorMm:ankle*1000});
}
console.log(JSON.stringify({collectionCoverage},null,2));
fs.writeFileSync(path.join(dir,'motion-samples.json'),JSON.stringify({fps:30,rest,actions,samples,summary}));
fs.writeFileSync(path.join(dir,'motion-metrics.json'),JSON.stringify({status:'numeric-only-not-visual-approval',summary,collectionCoverage},null,2));
console.log(JSON.stringify(summary,null,2));
