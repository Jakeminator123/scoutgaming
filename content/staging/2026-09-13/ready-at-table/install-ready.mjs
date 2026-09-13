import fs from 'node:fs';import{createHash}from'node:crypto';
import{sceneJoinPayload}from'../../../../web/public/scene-join.mjs';import{readyMotionErrors}from'../../../../web/public/ready-motion.mjs';
const root=new URL('./',import.meta.url),pub=new URL('../../../../web/public/',root),read=p=>JSON.parse(fs.readFileSync(p));
const m=read(new URL('ready-manifest-draft.json',root));
for(const clip of[m.loop,m.speech,...m.joins])clip.calibrationSha256=createHash('sha256').update(sceneJoinPayload(clip)).digest('hex');
const takes=read(new URL('dealers/astrid/performance/smooth60/manifest.json',pub)).takes,idle=read(new URL('dealers/astrid/actor/provenance.json',pub)).sources['idle-1/idle/idle'];
const errors=readyMotionErrors(m,takes,idle);if(errors.length)throw Error(errors.join(';'));
const target=new URL('dealers/astrid/performance/joins/ready/manifest.json',pub);fs.writeFileSync(target,JSON.stringify(m));console.log('Complete ready manifest installed for gameplay review.');
