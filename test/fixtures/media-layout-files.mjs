// Writes exact media bytes and media/layout.json under an explicit test root.
// Each row names its canonical path, its former path and its access; public
// rows may carry their published URL. Nothing is copied from an older layout.
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {validateMediaLayout} from '../../packages/studio-registry/server/media-layout.mjs';

export async function writeMediaLayoutFixture(root,{roots={},files}) {
  const rows=[];
  for(const {body,...row} of files){
    const bytes=Buffer.from(body),file=join(root,'media',...row.path.split('/'));
    await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes);
    rows.push({...row,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  const layout=validateMediaLayout({schemaVersion:1,roots,files:rows.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)});
  await writeFile(join(root,'media/layout.json'),JSON.stringify(layout,null,2)+'\n');
  return layout;
}
