// Install only the repaired greeting; preserve every other concurrent line.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const take=path.dirname(dir);
const pub=path.resolve(take,'../../../../web/public/review/astrid-green-speak');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
for(const name of ['actor-packed.mp4','manifest.json','rest-0115.png','rest-0115-crop.png'])fs.copyFileSync(path.join(dir,name),path.join(take,'mask',name));
for(const name of fs.readdirSync(path.join(dir,'alpha')))fs.copyFileSync(path.join(dir,'alpha',name),path.join(take,'mask/alpha',name));
// A content-addressed media name avoids playing the old eye-key from cache.
const filename=`greeting-face-${manifest.actorPackedSha256.slice(0,12)}.mp4`;
fs.copyFileSync(path.join(dir,'actor-packed.mp4'),path.join(pub,filename));
for(const target of [path.join(pub,'speak.json'),path.join(take,'speak.json')]){
  const current=JSON.parse(fs.readFileSync(target));
  const media=current.version===2?current.lines.greeting.media:current.media;
  if(media.sourceSha256!==manifest.sourceSha256)throw new Error('Greeting source changed during repair');
  media.src=`review/astrid-green-speak/${filename}`;
  media.sha256=manifest.actorPackedSha256;
  media.matteRevision='opaque-head-interior-v2';
  fs.writeFileSync(target,JSON.stringify(current,null,2)+'\n');
}
console.log('Installed greeting-only face matte',filename);
