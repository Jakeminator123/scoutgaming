// Promote only the 16 repaired speech mattes. Exact media/audio pairing and
// registration are retained; content hashes keep rejected cached files out.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pub=path.resolve(root,'../../../../web/public/review/astrid-green-speak');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(pub,'speak.json')));
const report=[];
for(const id of Object.keys(JSON.parse(fs.readFileSync(path.join(root,'jobs.json'))))){
  const dir=path.join(root,'lines',id),repair=path.join(dir,'mask-face-repair');
  const mask=JSON.parse(fs.readFileSync(path.join(repair,'manifest.json')));
  const check=JSON.parse(fs.readFileSync(path.join(repair,'encoded-eye-check.json')));
  const line=manifest.lines[id];
  if(!line||mask.sourceSha256!==line.media.sourceSha256)throw new Error(`${id}: source mismatch`);
  if(sha(path.join(repair,'actor-packed.mp4'))!==mask.actorPackedSha256)throw new Error(`${id}: mask hash mismatch`);
  if(check.frames!==line.media.frames||check.minimumEncodedRepairedAlpha<250)throw new Error(`${id}: encoded face check failed`);
  if(JSON.stringify(mask.crop)!==JSON.stringify(line.media.crop))throw new Error(`${id}: crop changed`);
  for(const name of ['actor-packed.mp4','manifest.json',`rest-${String(mask.restNativeFrame).padStart(4,'0')}.png`,`rest-${String(mask.restNativeFrame).padStart(4,'0')}-crop.png`])fs.copyFileSync(path.join(repair,name),path.join(dir,'mask',name));
  for(const name of fs.readdirSync(path.join(repair,'alpha')))fs.copyFileSync(path.join(repair,'alpha',name),path.join(dir,'mask/alpha',name));
  const name=`${id}-face-${mask.actorPackedSha256.slice(0,12)}.mp4`;
  fs.copyFileSync(path.join(repair,'actor-packed.mp4'),path.join(pub,name));
  line.media.src=`review/astrid-green-speak/${name}`;
  line.media.sha256=mask.actorPackedSha256;line.media.matteRevision='opaque-head-interior-v2';
  report.push({line:id,frames:check.frames,repairedPixels:mask.faceRepair.totalRepairedPixels,minimumEncodedAlpha:check.minimumEncodedRepairedAlpha,sha256:mask.actorPackedSha256});
}
for(const target of [path.join(pub,'speak.json'),path.join(root,'speak.json')])fs.writeFileSync(target,JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(root,'mask-face-repair/all-lines-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({lines:report.length,frames:report.reduce((n,r)=>n+r.frames,0),repairedPixels:report.reduce((n,r)=>n+r.repairedPixels,0)}));
