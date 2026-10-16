// Explicit authoring input for isolated tests only; native runtime never imports this helper.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {validateRuntimeMediaCatalog} from '../../web/storage/runtime-media-catalog.mjs';

export function readRuntimeCatalogFixture(root=fileURLToPath(new URL('../../',import.meta.url))) {
  const read=path=>JSON.parse(readFileSync(join(root,path),'utf8'));
  const layout=read('media/layout.json'),blobIndex=read('media/blob-index.json');
  const paths=new Set(layout.files.map(row=>row.path));
  blobIndex.files=blobIndex.files.filter(row=>paths.has(row.logicalPath));
  const legacy=read('media/catalog/legacy.json'),byPath=new Map(layout.files.map(row=>[row.path,row]));
  for(const row of blobIndex.files.filter(row=>['public','private'].includes(row.access)&&row.storage?.contentType==='application/json')) {
    const entry=byPath.get(row.logicalPath),bytes=readFileSync(join(root,'media',entry.canonicalPath??entry.path));
    if(bytes.length!==row.size||createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('Runtime catalogue fixture metadata identity mismatch');
    const text=bytes.toString('utf8');if(!Buffer.from(text,'utf8').equals(bytes))throw Error('Runtime catalogue fixture metadata encoding mismatch');
    JSON.parse(text);legacy.entries['media/'+row.logicalPath]=text;
  }
  return validateRuntimeMediaCatalog({schemaVersion:1,layout,blobIndex,presentation:read('media/catalog/presentation.json'),legacy});
}
