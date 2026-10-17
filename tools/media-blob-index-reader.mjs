import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
import {validateMediaBlobIndex} from '../packages/studio-registry/server/media-blob-index.mjs';
const cached=new Map();
/** The configured private server index contains IDs/pathnames, never Blob URLs. */
export function readLocalMediaBlobIndex(options={}){
  const {env=process.env,indexPath=env.CROUPIER_MEDIA_BLOB_INDEX}=options;
  if(!indexPath)return null;
  if(!isAbsolute(indexPath))throw new Error('Absolute media Blob index required.');
  const file=resolve(indexPath),info=lstatSync(file),actual=realpathSync(file);
  if(!info.isFile()||info.isSymbolicLink()||actual.toLowerCase()!==file.toLowerCase()||info.size>16*1024*1024)throw new Error('Unsafe media Blob index.');
  const key=`${info.size}:${info.mtimeMs}`;if(cached.get(file)?.key===key)return cached.get(file).index;
  const data=JSON.parse(readFileSync(file,'utf8'));
  const index=validateMediaBlobIndex(data);cached.set(file,{key,index});return index;
}
