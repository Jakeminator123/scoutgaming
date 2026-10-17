import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {canonicalStudioJson,StudioStorageError} from './studio-contract.mjs';
import {isPresentationRoom} from '../../packages/presentation/contracts/presentation-room.mjs';
import {OPERATOR_LIFECYCLE_KEY} from '../../packages/presentation/contracts/operator-lifecycle-key.mjs';
import {validateGameLanes} from '../public/game-lanes.mjs';

// Server-owned lifecycle data uses the existing immutable package JSON. No new
// database schema or room shape: old runtimes still see only current rooms.
export {OPERATOR_LIFECYCLE_KEY} from '../../packages/presentation/contracts/operator-lifecycle-key.mjs';
const fail=(status=503)=>{throw new StudioStorageError('studio_invalid_resource_lifecycle',status);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value));
function checked(value){
 if(!exact(value,['schemaVersion','operator','rooms'])||value.schemaVersion!==1||!Array.isArray(value.rooms)||value.rooms.length>1000)fail();
 if(value.operator!==null&&(!exact(value.operator,['archivedAt'])||!timestamp(value.operator.archivedAt)))fail();
 const ids=new Set();
 for(const entry of value.rooms){
  if(!exact(entry,['archivedAt','room','gameLane','sourcePackageRevision'])||!timestamp(entry.archivedAt)||!isPresentationRoom(entry.room)
   ||ids.has(entry.room.id)||!Number.isSafeInteger(entry.sourcePackageRevision)||entry.sourcePackageRevision<1)fail();
  try{validateGameLanes([entry.gameLane]);}catch{fail();}
  if(entry.gameLane.id!==entry.room.gameLaneId)fail();ids.add(entry.room.id);
 }
 return value;
}
export function readOperatorLifecycle(branding){
 if(!Object.hasOwn(branding??{},OPERATOR_LIFECYCLE_KEY))return {schemaVersion:1,operator:null,rooms:[]};
 const value=branding[OPERATOR_LIFECYCLE_KEY];
 if(!exact(value,['format','encoding','sha256','data'])||value.format!=='scout-lifecycle-v1'||value.encoding!=='gzip-base64url'
  ||typeof value.data!=='string'||value.data.length>7000||!value.data.length||!/^[A-Za-z0-9_-]+$/.test(value.data)||!(/^[a-f0-9]{64}$/).test(value.sha256))fail();
 try{
  const zipped=Buffer.from(value.data,'base64url');if(zipped.toString('base64url')!==value.data)fail();
  const bytes=gunzipSync(zipped,{maxOutputLength:512*1024});if(hash(bytes)!==value.sha256)fail();
  const parsed=checked(JSON.parse(bytes.toString('utf8')));if(canonicalStudioJson(parsed)!==bytes.toString('utf8'))fail();return parsed;
 }catch{fail();}
}
export function withOperatorLifecycle(branding,lifecycle){
 const next=structuredClone(branding??{}),value=checked(structuredClone(lifecycle));
 if(value.operator===null&&!value.rooms.length){delete next[OPERATOR_LIFECYCLE_KEY];return next;}
 const bytes=Buffer.from(canonicalStudioJson(value)),data=gzipSync(bytes).toString('base64url');
 if(bytes.length>512*1024||data.length>7000)fail(413);
 next[OPERATOR_LIFECYCLE_KEY]={format:'scout-lifecycle-v1',encoding:'gzip-base64url',sha256:hash(bytes),data};
 if(Buffer.byteLength(canonicalStudioJson(next))>8000)fail(413);return next;
}