import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {canonicalStudioJson} from '../../packages/studio-registry/server/document-contract.mjs';
import {createSpeechReplyRepository} from '../../packages/presentation/server/speech-reply-repository.mjs';
import * as replyMediaStore from '../../web/blob-media.mjs';
import {createSpeechReplyLibrary} from '../../packages/presentation/server/speech-reply-library.mjs';
export const scope={environment:'qa',workspaceId:'jakob'};
export const env={CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture-private-token'};
export const input=(dealerId='astrid')=>({id:randomUUID(),dealerId,exactText:'Hej! Tack för frågan.',language:'sv',profileRevision:'a'.repeat(64),audio:{bytes:Buffer.from('WAV exact bytes'),contentType:'audio/wav'},video:{bytes:Buffer.from('MP4 exact bytes'),contentType:'video/mp4'}});
export function memorySql(){
  const data=new Map(),calls=[];
  const key=args=>JSON.stringify(args.slice(0,4));
  const immutable=value=>{const {categories,revision,...rest}=value;return canonicalStudioJson(rest);};
  return {data,calls,async query(sql,args){
    calls.push({sql,args:structuredClone(args)});
    if(sql.startsWith('INSERT')){
      assert.match(sql,/ON CONFLICT \(environment_id,workspace_id,dealer_id,id\) DO NOTHING/);
      if(data.has(key(args)))return {rows:[]};
      const row={environment_id:args[0],workspace_id:args[1],dealer_id:args[2],id:args[3],revision:args[4],value:JSON.parse(args[5])};data.set(key(args),row);return{rows:[structuredClone(row)]};
    }
    assert.match(sql,/WHERE environment_id=\$1 AND workspace_id=\$2 AND dealer_id=\$3/);
    if(sql.startsWith('UPDATE')){
      assert.match(sql,/AND id=\$4 AND revision=\$5/);assert.match(sql,/\(value-'categories'-'revision'\)=\(\$6::jsonb-'categories'-'revision'\)/);
      const row=data.get(key(args)),value=JSON.parse(args[5]);if(!row||row.revision!==args[4]||immutable(row.value)!==immutable(value))return {rows:[]};
      row.value=value;row.revision++;return {rows:[structuredClone(row)]};
    }
    if(sql.includes('ORDER BY id')){
      const rows=[...data.values()].filter(row=>row.environment_id===args[0]&&row.workspace_id===args[1]&&row.dealer_id===args[2]&&(!args[3]||row.id>args[3])&&(!args[4]||row.value.categories.includes(args[4]))).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,51);return{rows:structuredClone(rows)};
    }
    assert.match(sql,/AND id=\$4/);const row=data.get(key(args));return {rows:row?[structuredClone(row)]:[]};
  }};
}
export async function fixture(t){
  const cacheDir=await mkdtemp(join(tmpdir(),'reply-library-test-'));t.after(()=>rm(cacheDir,{recursive:true,force:true}));
  const objects=new Map();let revision=0;
  const blob=(pathname,r)=>({pathname,url:`https://fixture.private.blob.vercel-storage.com/${pathname}`,size:r.bytes.length,contentType:r.contentType,etag:r.etag});
  const blobClient={
    async put(pathname,bytes,o){assert.equal(o.access,'private');assert.equal(o.addRandomSuffix,false);if(objects.has(pathname)&&!o.allowOverwrite)throw Object.assign(Error('private-provider-error'),{name:'BlobAlreadyExistsError'});const row={bytes:Buffer.from(bytes),contentType:o.contentType,etag:`"${++revision}"`};objects.set(pathname,row);return blob(pathname,row);},
    async get(pathname,o){assert.equal(o.access,'private');const row=objects.get(pathname);return row?{statusCode:200,stream:new Response(row.bytes).body,blob:blob(pathname,row)}:null;},
    async list(o){return{blobs:[...objects].filter(([path])=>path.startsWith(o.prefix)).map(([path,row])=>blob(path,row)),hasMore:false};},
    async del(pathname){objects.delete(pathname);},
  };
  const sql=memorySql(),repository=createSpeechReplyRepository({sql,scope});
  const options={mediaStore:replyMediaStore,repository,env,...scope,blobClient,cacheDir};
  return {objects,options,blobClient,sql,repository,library:createSpeechReplyLibrary(options),scope,cacheDir};
}
