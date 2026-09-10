import fs from 'node:fs';
import {mapFacialWeights,prepareFacialPerformance} from '../web/public/dealer-face.mjs';
const [source,destination]=process.argv.slice(2);
if(!source||!destination)throw new Error('Pass measured performance JSON and output JSON');
const data=JSON.parse(fs.readFileSync(source));prepareFacialPerformance(data);
fs.writeFileSync(destination,JSON.stringify({source:data.source,sourceHash:data.sha256,fps:data.fps,duration:data.duration,
 frames:data.frames.map(f=>({frame:1+f.time*data.fps,weights:mapFacialWeights(f.weights)}))}));
