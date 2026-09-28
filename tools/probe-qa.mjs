import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { startIsolatedConnection } from '../open-claw/lab/deploy/local-connection.mjs';
import { prepareProject } from '../lab/start.mjs';
import { createProjectStore } from '../lab/lib/project-store.mjs';
import { createDefaultProbePolicy } from '../lab/lib/probe-policy.mjs';
import { demoProbeMemories } from '../lab/lib/probe-fixtures.mjs';
import { DatabaseSync } from 'node:sqlite';
import { createPlayerChatMemory } from '../web/player-chat-memory.mjs';
import { createPlayerProbeStore } from '../web/player-probe-store.mjs';

if(process.argv.slice(2).some(arg=>!['--speech','--demo-memories'].includes(arg)))throw new Error('Use --speech and optionally --demo-memories.');

const directory=await mkdtemp(join(tmpdir(),'croupier-probe-qa-'));
let fixture;
async function stop(){
  await fixture?.stop();
  const target=resolve(directory);
  if(dirname(target)!==resolve(tmpdir())||!basename(target).startsWith('croupier-probe-qa-'))throw new Error('Invalid QA cleanup directory');
  await rm(target,{recursive:true,force:true});
}
try{
  const studioDataDir=await prepareProject(join(directory,'studio'));
  const demo=process.argv.includes('--demo-memories');
  const policy={...createDefaultProbePolicy(),mode:demo?'automatic':'text',inactivityMs:10000,cooldownMs:30000,probability:1,maxPerHour:12};
  const projects=createProjectStore(studioDataDir),project=await projects.load();
  await projects.save({...project,probePolicy:policy},project.revision);
  fixture=await startIsolatedConnection({productPort:4210,labPort:4211,studioDataDir,streamLane:'lissabon-stream-lane',labDistDir:'.next-probe',generatedSpeech:process.argv.includes('--speech')});
  if(demo){
    // Both the directory and profile are newly created here. Never accept a DB
    // path or player ID supplied by a caller, and never seed the real lane.
    const origin='http://localhost:4210';
    const response=await fetch(`${origin}/api/lissabon/profiles`,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({action:'create',name:'Jakob · TESTMINNEN'})});
    if(!response.ok)throw new Error('Could not create the isolated synthetic profile.');
    const {current}=await response.json();
    const db=new DatabaseSync(join(studioDataDir,'players','croupier.db'));
    try{
      const memory=createPlayerChatMemory(db),store=createPlayerProbeStore(db,memory),scope={playerId:current.id,dealerId:'astrid'};
      const facts=demoProbeMemories();
      for(const fact of facts)store.message(scope,fact.source.messageId,fact.source.quote);
      for(let i=0;i<3;i++)store.message(scope,`synthetic-extra-${i}`,'I am testing this fictional demo profile.');
      const job=store.extraction(scope,policy);
      if(!job || !store.saveExtraction(scope,job,facts.map(fact=>({sourceId:fact.source.messageId,topicId:fact.topicId,quote:fact.source.quote,content:fact.content,notBefore:0,expiresAt:fact.expiresAt})),policy))throw new Error('Synthetic memories were not seeded.');
      if(store.inspect(scope,policy).facts.length!==5)throw new Error('Expected five synthetic memories.');
    }finally{db.close();}
  }
  // Use a different hostname from the real 127.0.0.1 lane: browser cookies and
  // profile broadcasts are hostname-scoped, not isolated by port alone.
  console.log(JSON.stringify({urls:{product:'http://localhost:4210/?dealer=astrid&presentation=local',lab:'http://localhost:4211/probe'},pids:fixture.pids,scope:'synthetic-isolated',speech:process.argv.includes('--speech'),demoMemories:demo,studioDataDir}));
  if(demo)console.log('Choose Jakob · TESTMINNEN. All five memories are fictional; the claimed win is NOT a server result. Automatic: 10 s idle, 30 s cooldown, 100% sampling, max 12/hour; one unanswered initiative. Only this disposable QA environment uses these settings.');
  process.once('SIGINT',()=>void stop().then(()=>process.exit()));
  process.once('SIGTERM',()=>void stop().then(()=>process.exit()));
}catch(error){await stop();console.error(error.message);process.exitCode=1;}
