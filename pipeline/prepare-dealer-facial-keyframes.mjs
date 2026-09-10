import fs from 'node:fs';
import {prepareFacialPerformance} from '../web/public/dealer-face.mjs';
const [source,destination,modelSha256]=process.argv.slice(2);
if(!source||!destination)throw new Error('Pass measured performance JSON and output JSON');
const data=JSON.parse(fs.readFileSync(source));const performance=prepareFacialPerformance(data,modelSha256?{modelSha256}:{});
fs.writeFileSync(destination,JSON.stringify({source:data.source,sourceHash:data.sha256,fps:data.fps,duration:data.duration,
 rigModelHash:performance.rigModelHash,
 frames:data.frames.map(f=>({frame:1+f.time*data.fps,weights:performance.sample(f.time)}))}));
