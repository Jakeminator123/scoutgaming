import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadRigGeometry} from './load-dealer-rig.mjs';
import {planCollection} from '../web/public/dealer-collection.mjs';
import {riggedCardPose} from '../web/public/rigged-card-layout.mjs';
import {poseCardAction} from '../web/public/dealer-rig.mjs';
const output=process.argv[2];if(!output)throw new Error('Pass a separate collection study directory');
fs.mkdirSync(output,{recursive:true});
const folder=new URL('../web/public/dealers/astrid/rig/face-study/',import.meta.url);
const model=new URL('astrid-rigged.glb',folder),profile=JSON.parse(fs.readFileSync(new URL('profile.json',folder)));
const {rig}=loadRigGeometry(model,profile),rest=Object.fromEntries([...rig.bones].map(([name,b])=>[name,b.matrixWorld.toArray()]));
const table=JSON.parse(fs.readFileSync(new URL('../assets/blackjack-3d/profile.json',import.meta.url))),cards=[];
for(let seat=0;seat<7;seat++)for(let cardIndex=0;cardIndex<2;cardIndex++)cards.push({id:cards.length,group:`${seat}:0`,...riggedCardPose({profile:table,seat,cardIndex,cardCount:2})});
for(let cardIndex=0;cardIndex<2;cardIndex++)cards.push({id:cards.length,group:'dealer',...riggedCardPose({profile:table,cardIndex,cardCount:2})});
const landing=[-.91,.920,.25],plan=planCollection(cards,{landing}),samples=[],last=Math.ceil(plan.duration*30);
let floor=Infinity,reach=0,contact=0;
for(let frame=0;frame<=last;frame++){
 const sample=plan.sample(frame/30),pose=poseCardAction(rig,sample.progress,{kind:'collect-sweep',sample});
 floor=Math.min(floor,rig.handFloor('left'),rig.handFloor('right'));reach=Math.max(reach,pose.errors[sample.active]);contact=Math.max(contact,pose.fingerError);
 samples.push({seat:0,action:'Collect_All_Cards_Sweep_Study',frame:frame+1,progress:sample.progress,phase:sample.phase,count:sample.count,
  card:sample.card,cardPitch:0,cardYaw:0,cards:sample.transforms,bones:Object.fromEntries([...rig.bones].map(([name,b])=>[name,b.matrixWorld.toArray()]))});
}
const metrics={status:'numeric-only-not-visual-approval',frames:samples.length,duration:plan.duration,cards:cards.length,minHandHeightMm:floor*1000,maxWristErrorMm:reach*1000,maxFingertipErrorMm:contact*1000};
if(floor<.9098||reach>.001)throw new Error(JSON.stringify(metrics));
fs.writeFileSync(path.join(output,'motion-samples.json'),JSON.stringify({fps:30,modelSha256:createHash('sha256').update(fs.readFileSync(model)).digest('hex'),rest,cards,landing,actions:[{name:'Collect_All_Cards_Sweep_Study',kind:'collect-sweep',seconds:plan.duration}],samples}));
fs.writeFileSync(path.join(output,'motion-metrics.json'),JSON.stringify(metrics,null,2)+'\n');console.log(metrics);
