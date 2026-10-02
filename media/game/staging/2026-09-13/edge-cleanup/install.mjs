// Promote only this reviewed upper-edge repair, with immutable media filenames.
import fs from 'node:fs';import path from 'node:path';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
import{calibrationPayload}from '../../../../web/public/performance-contact.mjs';
import{sceneJoinPayload,validateSceneJoin}from '../../../../web/public/scene-join.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),pub=path.resolve(root,'../../../../web/public');
const sha=x=>createHash('sha256').update(x).digest('hex'),records=JSON.parse(fs.readFileSync(path.join(root,'receipt.json')));
const takePath=path.join(pub,'dealers/astrid/performance/smooth60/manifest.json'),joinPath=path.join(pub,'dealers/astrid/performance/joins/manifest.json');
const takes=JSON.parse(fs.readFileSync(takePath)),joins=JSON.parse(fs.readFileSync(joinPath));
for(const item of [...takes.takes,...joins.joins]){
 const rec=records.find(r=>r.id===item.id);if(!rec||rec.inputSha256!==item.media.sha256)throw Error('Input changed: '+item.id);
 const bytes=fs.readFileSync(path.join(root,rec.group,path.basename(rec.src)));if(sha(bytes)!==rec.outputSha256)throw Error('Output changed');
 item.media.src=rec.src.replace('.mp4','-edge-v2.mp4');item.media.sha256=rec.outputSha256;
 fs.writeFileSync(path.join(pub,item.media.src),bytes);
}
for(const take of takes.takes)take.calibrationSha256=sha(calibrationPayload(take));
for(const join of joins.joins){for(const binding of join.bindings){const take=takes.takes.find(t=>t.id===binding.takeId);binding.mediaSha256=take.media.sha256;binding.calibrationSha256=take.calibrationSha256;}
 join.calibrationSha256=sha(sceneJoinPayload(join));if(validateSceneJoin(join).length)throw Error('Invalid join');}
for(const [dest,value]of[[takePath,takes],[joinPath,joins]]){fs.writeFileSync(dest+'.tmp',JSON.stringify(value));fs.renameSync(dest+'.tmp',dest);}
console.log('Installed upper-edge repair; source clocks, card events and speech media preserved.');
