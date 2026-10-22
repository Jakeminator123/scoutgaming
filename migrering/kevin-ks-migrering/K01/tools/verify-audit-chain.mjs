// Recompute audit_events hash chain exactly as server/game-audit.mjs:19-23 + vendor/croupier/shoe-proof.mjs:2 do.
// Usage: KEVIN_SRC=<checkout>/kevin/croupier-scoutgg node tools/verify-audit-chain.mjs [existing.sqlite]
// KEVIN_SRC must point at the croupier-scoutgg directory of kevin-merge-admin (frozen 5aa7ed1).
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,existsSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';
const SRC=process.env.KEVIN_SRC&&resolve(process.env.KEVIN_SRC);
if(!SRC||!existsSync(join(SRC,'server','shared-table.mjs'))){console.error('Set KEVIN_SRC to <checkout>/kevin/croupier-scoutgg (kevin-merge-admin)');process.exit(2);}
const {createSharedTable}=await import(pathToFileURL(join(SRC,'server','shared-table.mjs')).href);
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const file=process.argv[2]??join(mkdtempSync(join(tmpdir(),'chain-')),'t.sqlite');
if(!process.argv[2]){
  let time=100000;const s=createSharedTable(file,{manifest:{deal:[],repliker:[],idle:[]},now:()=>time});
  const st=room=>s.run('k',{session:room,op:'state'});
  const send=(room,op,x={})=>s.run('k',{session:room,op,version:st(room).version,requestId:crypto.randomUUID(),...x});
  for(const room of ['a','b']){send(room,'join',{name:'Kevin',seats:[3]});send(room,'bet',{seat:3,field:'main',chip:5});send(room,'ready');}
  for(let i=0;i<40;i++){time+=5000;s.tick();for(const room of ['a','b']){const v=st(room);if(v.round?.phase==='decisions')try{send(room,'act',{action:'stand'})}catch{};if(v.round?.phase==='insurance')try{send(room,'insurance',{take:false})}catch{}}}
  s.close();
}
const db=new DatabaseSync(file,{readOnly:true});
let prev='genesis',ok=0,bad=0;const types=new Set();
for(const r of db.prepare('SELECT * FROM audit_events ORDER BY seq').all()){
  types.add(r.type);
  const h=digest({room:r.room,roundId:r.round_id??null,at:r.at,parent:r.parent,type:r.type,payload:r.payload,previous:r.previous_hash});
  if(h===r.hash&&r.previous_hash===prev)ok++;else bad++;prev=r.hash;
}
// negative: the same row with payload re-serialized via JSON.parse/stringify(sorted keys) must break
const row=db.prepare('SELECT * FROM audit_events ORDER BY seq LIMIT 1 OFFSET 3').get();
const sorted=o=>Array.isArray(o)?o.map(sorted):o&&typeof o==='object'?Object.fromEntries(Object.keys(o).sort().map(k=>[k,sorted(o[k])])):o;
const jsonbLike=JSON.stringify(sorted(JSON.parse(row.payload)));
const h2=digest({room:row.room,roundId:row.round_id??null,at:row.at,parent:row.parent,type:row.type,payload:jsonbLike,previous:row.previous_hash});
const h3=digest({room:row.room,roundId:row.round_id??null,at:String(row.at),parent:row.parent,type:row.type,payload:row.payload,previous:row.previous_hash});
console.log(JSON.stringify({file,rows:ok+bad,ok,bad,types:[...types].sort(),sortedKeysPayloadStillValid:h2===row.hash,payloadChangedBySort:jsonbLike!==row.payload,atAsStringStillValid:h3===row.hash,rooms:db.prepare('SELECT DISTINCT room FROM audit_events').all().map(x=>x.room)}));
