// Offline analysis of CUA-captured browser logs. Never drives gameplay or changes state.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../../../../..');
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const logs=read('final-performance.json');
const speech=read('speech.json');
const clicks=read('clicks.json');
const duration=(a,b)=>(Date.parse(b)-Date.parse(a))/1000;
const transitions=[];
let pending=null;
for(const item of logs){
 if(item.message.startsWith('[performance] Transition · '))pending=item;
 else if(item.message==='[performance] Transition complete'&&pending){transitions.push({name:pending.message.split(' · ')[1],start:pending.timestamp,end:item.timestamp,seconds:duration(pending.timestamp,item.timestamp)});pending=null;}
}
const actions=logs.filter(x=>x.message.startsWith('[performance] Dealing to'));
const measuredClicks=clicks.map(c=>{const action=actions.find(x=>x.timestamp>=c.timestamp);return {...c,firstAction:action?.timestamp,seconds:action?duration(c.timestamp,action.timestamp):null};});
const manifestBytes=fs.readFileSync(path.join(root,'web/public/dealers/astrid/performance/smooth60/manifest.json'));
const manifest=JSON.parse(manifestBytes);
const sources=manifest.takes.map(t=>{const bytes=fs.readFileSync(path.join(root,'web/public',t.media.src));return {id:t.id,src:t.media.src,expectedSha256:t.media.sha256,actualSha256:sha(bytes),integrity:sha(bytes)===t.media.sha256,tracking:t.tracking.kind,registeredCamera:t.camera,pickup:t.events.pickup,pickupContact:t.frames.find(f=>f.frame===t.events.pickup)?.contact};});
const errors=read('errors.json');
const final=read('final-dom.json');
const report={generatedAt:new Date().toISOString(),scope:'Existing browser-visible captured logs; disk SHA is current installed bytes, not response-byte browser provenance',manifestSha256:sha(manifestBytes),sources,clicks:measuredClicks,transitions,speech,final,checks:{noBrowserWarnings:errors.length===0,settled:final.cards===0&&final.layers===0&&final.banner==='PLEASE PLACE BETS',currentMediaIntegrity:sources.every(s=>s.integrity),physicalExtraction:'NOT ACCEPTED: requires native-frame actual outlet/hand/card evidence; logs cannot prove contact',screenOutlet:'NOT MEASURED in this capture. Manifest camera coordinate is source registration, not current viewport projection.'}};
fs.writeFileSync(path.join(dir,'acceptance.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({clicks:measuredClicks,checks:report.checks},null,2));
if(!report.checks.noBrowserWarnings||!report.checks.settled||!report.checks.currentMediaIntegrity)process.exitCode=1;
