// Package derived rig weights without modifying any measured source channel.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {mapFacialWeights} from '../web/public/dealer-face.mjs';
const [sourceFolder,measurementFolder,model,outputFolder]=process.argv.slice(2);
assert.ok(outputFolder,'Pass raw capture folder, lip measurements, model GLB and output folder');
const manifest=JSON.parse(fs.readFileSync(path.join(sourceFolder,'speech-manifest.json'))),modelHash=crypto.createHash('sha256').update(fs.readFileSync(model)).digest('hex');
assert.equal(manifest.modelSha256,modelHash);fs.mkdirSync(outputFolder,{recursive:true});const rows=[];
for(const [line,row] of Object.entries(manifest.lines)){
 const raw=JSON.parse(fs.readFileSync(path.join(sourceFolder,row.file))),measured=JSON.parse(fs.readFileSync(path.join(measurementFolder,row.file)));
 assert.equal(raw.sha256,measured.sha256);assert.equal(raw.frames.length,measured.frames.length);
 const candidate=structuredClone(raw);candidate.rigCalibration={schemaVersion:1,targetModelSha256:modelHash,method:'independent-image-lip-aperture',responseSlope:measured.calibration.modelResponseSlope,responseIntercept:measured.calibration.modelResponseIntercept,neutralApertureThreshold:.004,status:'rendered-review-required'};
 let maximum=0;
 candidate.frames.forEach((frame,i)=>{const observation=measured.frames[i];assert.equal(frame.time,observation.time);const aperture=observation.lipLandmarks.innerLipOpening;assert.ok(Number.isFinite(aperture)&&aperture>=0);const jaw=aperture<.004?0:Math.max(0,Math.min(1,(aperture-candidate.rigCalibration.responseIntercept)/candidate.rigCalibration.responseSlope));frame.rigWeights={...mapFacialWeights(frame.weights),jawOpen:jaw};frame.lipLandmarks=observation.lipLandmarks;assert.deepEqual(frame.weights,raw.frames[i].weights);maximum=Math.max(maximum,jaw);});
 fs.writeFileSync(path.join(outputFolder,row.file),JSON.stringify(candidate));rows.push({line,frames:raw.frames.length,maxJaw:maximum,rawChannelsPreserved:true});
}
fs.writeFileSync(path.join(outputFolder,'retarget-verification.json'),JSON.stringify({targetModelSha256:modelHash,lines:rows,frames:rows.reduce((n,r)=>n+r.frames,0),status:'raw channels and source binding preserved; rendered extreme review pending'},null,2));console.log(JSON.stringify(rows,null,2));
