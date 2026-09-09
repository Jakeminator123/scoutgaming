// Build one explicit in-game review candidate. The existing four deliveries
// and their measurements remain unchanged. Run person-mask.swift on the bridge
// frames first; the bridge contains no card contact and only uses actor alpha.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {packContactMedia} from './pack-contact-media.mjs';
import {calibrationPayload,validateContactTake,validateContinuation} from '../web/public/performance-contact.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const staging=path.resolve(process.argv[2]??path.join(root,'content/staging/2026-09-10/return-bridge'));
const contractFile=path.join(staging,'source-contract.json');
const contract=fs.existsSync(contractFile)?JSON.parse(fs.readFileSync(contractFile)):{
  action:'deal-centre',preserveThrough:124,resumeFrame:55,baseSource:'centre-source.mp4',
  baseMediaSha256:'7ccca94b5332f28cdd962fd70d34ac59152aecbac4748738bf53ac87331a7726',
  baseSourceSha256:'4b737bc4d41fe929b5f6b80905bddada23fb1eea6d31307b5214a55793f8e41b',
  bridgeSourceSha256:'6ba6f7c1e9b0c584ffa0ecc06be276ac6d1cd99c722bcb78e3e88750ab7e7e14',
};
const name={'deal-centre':'centre','deal-left':'left','deal-right':'right','deal-dealer':'dealer'}[contract.action];
if(!name||!/^[-\w]+\.mp4$/.test(contract.baseSource))throw new Error('Invalid action or base source');
const end=Number(process.argv[3]??56); // Exclusive bridge end, chosen by frame review.
const start=contract.bridgeStartFrame??1;
if(!Number.isInteger(start)||start<1||!Number.isInteger(end)||end<=start||end>97)throw new Error('Invalid reviewed bridge interval');
const bridgeFrames=end-start;
const publicRoot=path.join(root,'web/public'),prefix='dealers/astrid/performance';
const manifestFile=path.join(publicRoot,prefix,'manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestFile));
const base=manifest.takes.find(t=>t.action===contract.action);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(!base||base.media.sha256!==contract.baseMediaSha256)throw new Error('Delivery source changed; review new anchors');
for(const [file,expectedHash] of [
  [path.join(publicRoot,base.media.src),base.media.sha256],
  [path.join(publicRoot,prefix,contract.baseSource),contract.baseSourceSha256],
  [path.join(staging,'source.mp4'),contract.bridgeSourceSha256],
])if(sha(fs.readFileSync(file))!==expectedHash)throw new Error('Source bytes changed; review new anchors: '+file);
const {preserveThrough,resumeFrame}=contract;
if(!Number.isInteger(preserveThrough)||preserveThrough<base.events.land||preserveThrough>=base.media.frames||!Number.isInteger(resumeFrame)||resumeFrame<0||resumeFrame>=base.events.pickup)throw new Error('Return must follow landing and resume before pickup');
const masks=path.join(staging,'continuation-masks');fs.mkdirSync(masks,{recursive:true});
const ffmpeg=args=>execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error',...args]);
ffmpeg(['-i',path.join(publicRoot,base.media.src),'-vf',`crop=iw:ih/2:0:ih/2,trim=end_frame=${preserveThrough+1}`,'-fps_mode','vfr',path.join(masks,'%04d.png')]);
// A separate temporary prefix avoids including stale frames from an older trim.
const bridgeMasks=path.join(staging,'bridge-masks');fs.mkdirSync(bridgeMasks,{recursive:true});
ffmpeg(['-framerate','24','-i',path.join(staging,'person/%04d.png'),'-vf',`trim=start_frame=${start}:end_frame=${end},format=rgb24,lutrgb=g=0:b=0`,'-fps_mode','vfr',path.join(bridgeMasks,'%04d.png')]);
for(let i=1;i<=bridgeFrames;i++)fs.copyFileSync(path.join(bridgeMasks,String(i).padStart(4,'0')+'.png'),path.join(masks,String(preserveThrough+1+i).padStart(4,'0')+'.png'));
const expected=preserveThrough+1+bridgeFrames;
// Remove only surplus output PNGs created by this builder, never source masks.
for(const f of fs.readdirSync(masks))if(/^\d{4}\.png$/.test(f)&&Number(f.slice(0,4))>expected)fs.unlinkSync(path.join(masks,f));
const sourceOutput=path.join(staging,`${name}-return-source.mp4`);
const packedOutput=path.join(publicRoot,prefix,`${name}-return-review.mp4`);
const segments=[{file:path.join(publicRoot,prefix,contract.baseSource),start:0,end:preserveThrough+1},{file:path.join(staging,'source.mp4'),start,end}];
const media=packContactMedia({segments,masks,sourceOutput,packedOutput});
const take=structuredClone(base);
take.id=`astrid-${name}-return-review-20260910`;take.status='review';
take.media={...base.media,...media,src:`${prefix}/${name}-return-review.mp4`,sha256:sha(fs.readFileSync(packedOutput))};
take.frames=base.frames.slice(0,preserveThrough+1).concat(Array.from({length:bridgeFrames},(_,i)=>({frame:preserveThrough+1+i,card:null})));
take.events={...base.events,rest:media.frames-1};
take.continuation={baseId:base.id,baseMediaSha256:base.media.sha256,baseCalibrationSha256:base.calibrationSha256,preserveThrough,
  resume:manifest.takes.map(t=>({takeId:t.id,mediaSha256:t.media.sha256,calibrationSha256:t.calibrationSha256,frame:resumeFrame}))};
take.calibrationSha256=sha(calibrationPayload(take));
take.review={result:'pending',date:'2026-09-10',details:'Empty-hand return candidate. Review both joins in the game; no contact or continuity approval inferred from integrity checks.'};
take.transitionReview={date:'2026-09-10',result:'pending',scope:`${name} delivery tail to empty-hand return, then registered next pickup at frame ${resumeFrame}`};
const errors=[...validateContactTake(take),...validateContinuation(take,manifest.takes)];
if(errors.length)throw new Error(errors.join('; '));
manifest.continuations=[...(manifest.continuations??[]).filter(t=>t.continuation?.baseId!==base.id),take];
manifest.reviewCandidates=[...new Set([...manifest.reviewCandidates,take.id])];
fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(staging,'continuation-recipe.json'),JSON.stringify({segments,bridgeSourceSha256:sha(fs.readFileSync(path.join(staging,'source.mp4'))),preserveThrough,resumeFrame,bridgeStartFrame:start,bridgeEndExclusive:end,media:take.media,calibrationSha256:take.calibrationSha256},null,2)+'\n');
console.log(JSON.stringify({id:take.id,frames:media.frames,entryResumeFrame:resumeFrame,status:take.status}));
