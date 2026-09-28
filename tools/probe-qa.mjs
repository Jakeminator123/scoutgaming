import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { startIsolatedConnection } from '../open-claw/lab/deploy/local-connection.mjs';

const directory=await mkdtemp(join(tmpdir(),'croupier-probe-qa-'));
let fixture;
async function stop(){
  await fixture?.stop();
  const target=resolve(directory);
  if(dirname(target)!==resolve(tmpdir())||!basename(target).startsWith('croupier-probe-qa-'))throw new Error('Invalid QA cleanup directory');
  await rm(target,{recursive:true,force:true});
}
try{
  fixture=await startIsolatedConnection({productPort:4210,labPort:4211,studioDataDir:join(directory,'studio'),streamLane:'lissabon-stream-lane',labDistDir:'.next-probe',generatedSpeech:process.argv.includes('--speech')});
  console.log(JSON.stringify({urls:fixture.urls,pids:fixture.pids,scope:'synthetic-isolated',speech:process.argv.includes('--speech')}));
  process.once('SIGINT',()=>void stop().then(()=>process.exit()));
  process.once('SIGTERM',()=>void stop().then(()=>process.exit()));
}catch(error){await stop();console.error(error.message);process.exitCode=1;}
