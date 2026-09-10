import fs from 'node:fs';
import path from 'node:path';
import * as T from '../web/public/vendor/three/three.module.js';
import {controlDealer,poseDealer} from '../web/public/dealer-rig.mjs';
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
for(let seat=0;seat<8;seat++){
 let worst=0,contact=0,feet=0;
 for(let f=0;f<51;f++){
  const p=f/50,{sample,errors,footErrors,fingerError}=poseDealer(rig,p,seat===7?[0,.916,.23]:seatTarget(seat),tableProfile.outlet);
  feet=Math.max(feet,...Object.values(footErrors));
  worst=Math.max(worst,errors[sample.active]);if(sample.picked&&!sample.released)contact=Math.max(contact,fingerError);
  samples.push({frame:seat*51+f+1,seat,progress:p,phase:sample.phase,card:sample.card,bones:Object.fromEntries([...rig.bones].map(([name,b])=>[name,b.matrixWorld.toArray()]))});
 }
 summary.push({seat:seat+1,maxActiveWristErrorMm:Math.round(worst*10000)/10,maxCarryFingerErrorMm:Math.round(contact*10000)/10,maxAnkleErrorMm:Math.round(feet*10000)/10});
}
fs.writeFileSync(path.join(dir,'motion-samples.json'),JSON.stringify({fps:30,rest,samples,summary}));
fs.writeFileSync(path.join(dir,'motion-metrics.json'),JSON.stringify({status:'numeric-only-not-visual-approval',summary},null,2));
console.log(JSON.stringify(summary,null,2));
