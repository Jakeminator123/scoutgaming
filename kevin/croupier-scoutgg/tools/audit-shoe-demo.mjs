// Isolated QA only. Refuses any pre-existing database; never modifies live data.
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createSharedTable} from '../server/shared-table.mjs';
import {classifyManifest} from '../server/media-registry.mjs';
const dir=process.argv[2];if(!dir)throw Error('Pass a new isolated output directory');
mkdirSync(dir,{recursive:true});const file=path.join(dir,'qa.sqlite');if(existsSync(file))throw Error('Refusing existing database');
const {manifest}=classifyManifest(JSON.parse(readFileSync(new URL('../public/media/manifest.json',import.meta.url))));
for(const clips of [manifest.deal,manifest.repliker])for(const clip of clips)clip.dur=.1;
let time=Date.now()-7200000;
const table=createSharedTable(file,{manifest,now:()=>time});
const state=()=>table.run('isolated-proof-review',{session:'audit-review',op:'state'});
const send=(op,extra={})=>table.run('isolated-proof-review',{session:'audit-review',op,version:state().version,requestId:crypto.randomUUID(),...extra});
try{
 send('join',{name:'Audit Review',seats:[0,1,2,3,4,5,6]});const first=state().shoe;
 for(let round=0;round<50&&state().shoe.id===first.id;round++){
  if(state().phase==='settled')send('next');if(state().me.balance<200)send('refill');
  for(let seat=0;seat<7;seat++){send('bet',{seat,field:'main',chip:5});send('bet',{seat,field:'pp',chip:5});}
  send('ready');
  for(let turn=0;turn<30&&state().phase==='round';turn++){
   time=state().plan.endAt+1;table.tick();const v=state();if(v.phase!=='round')break;
   if(v.round.phase==='insurance')send('insurance',{take:false});
   else if(v.round.phase==='decisions')send('act',{action:'stand'});
  }
 }
 const proof=table.backoffice({room:'audit-review',shoeId:first.id});
 if(proof.verification.status!=='verified')throw Error(JSON.stringify(proof.verification));
 writeFileSync(path.join(dir,'closed-shoe.json'),JSON.stringify(proof,null,2));
 writeFileSync(path.join(dir,'opening-commitment.json'),JSON.stringify({shoeId:first.id,commitment:first.commitment},null,2));
 console.log(JSON.stringify({database:file,shoeId:first.id,commitment:first.commitment,drawn:proof.proof.draws.length,unused:proof.proof.remaining.length,status:proof.verification.status}));
}finally{table.close();}
