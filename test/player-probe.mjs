import test from 'node:test';
import assert from 'node:assert/strict';
import { createPgliteStore } from './fixtures/pglite-pool.mjs';
import { createPlayerChatMemory } from '../services/game/storage/async-player-chat-memory.mjs';
import { createPlayerProbeStore } from '../services/game/storage/async-player-probe-store.mjs';
import { createProbeRuntime } from '../services/game/storage/async-probe-runtime.mjs';
import { createDefaultProbePolicy } from '../packages/presentation/contracts/probe-policy.mjs';
import { normalizeProbeRequest, validateProbeChoice, decideProductProbe, createProductProbeService } from '../packages/director/product-probe.mjs';
import { probeFixtures } from '../packages/presentation/contracts/probe-fixtures.mjs';
import { createSeedProject, validateProject } from '../packages/presentation/contracts/studio-model.mjs';
import { rebaseProjectDraft } from '../apps/studio/lib/project-rebase.mjs';
import { probePresentationQuiet } from '../services/game/public/probe-client.mjs';
import { projectConversationMemory, normalizeConversationMemory, CONVERSATION_MEMORY_LIMITS } from '../packages/director/conversation-memory.mjs';

test('new Astrid policies explicitly select Terra without enabling proactive speech',()=>{
  const policy=createDefaultProbePolicy();
  assert.equal(policy.model,'gpt-5.6-terra');
  assert.equal(policy.mode,'off');
  assert.equal(createSeedProject().probePolicy.model,'gpt-5.6-terra');
});

test('background idle does not cancel preparation, but cannot authorize a new probe or mask gameplay',()=>{
  const input={busy:false,round:null,chatBusy:false,speaking:false,pending:0,ownJobId:'preparing',idleBackground:true,
    gate:{state:{actionOwner:'none',dealerPose:'action'},get:()=>null}};
  assert.equal(probePresentationQuiet(input),true);
  assert.equal(probePresentationQuiet({...input,ownJobId:null}),false);
  assert.equal(probePresentationQuiet({...input,idleBackground:false}),false);
  assert.equal(probePresentationQuiet({...input,busy:true}),false);
  assert.equal(probePresentationQuiet({...input,round:{phase:'dealing'}}),false);
  assert.equal(probePresentationQuiet({...input,chatBusy:true}),false);
  assert.equal(probePresentationQuiet({...input,pending:1}),false);
  assert.equal(probePresentationQuiet({...input,speaking:true}),false);
  input.gate.get=()=>({status:'held'});assert.equal(probePresentationQuiet(input),true);
  input.gate.state.actionOwner='deal';assert.equal(probePresentationQuiet(input),false);
});

const DAY=86400000,scope={playerId:'synthetic-anna',dealerId:'astrid'};
const present={present:true,quiet:true,typing:false,enabled:true,sound:true};
const choice={speak:true,text:'Are you still there, Anna?',memoryIds:[],topicId:'name-check',reason:'generated'};

test('the queued initiative can authorize itself while other speech, actions and chat still veto it',()=>{
  let state='displaying';const input={busy:false,round:null,chatBusy:false,speaking:false,pending:1,ownJobId:'probe',
    gate:{state:{actionOwner:'none',dealerPose:'standard-idle'},get:id=>id==='probe'?{status:state}:null}};
  assert.equal(probePresentationQuiet(input),true);
  assert.equal(probePresentationQuiet({...input,ownJobId:'other'}),false);
  assert.equal(probePresentationQuiet({...input,pending:2}),false);
  assert.equal(probePresentationQuiet({...input,chatBusy:true}),false);
  assert.equal(probePresentationQuiet({...input,round:{phase:'decisions'}}),false);
  state='speaking';input.speaking=true;input.gate.state.dealerPose='speech';assert.equal(probePresentationQuiet(input),true);
  input.gate.state.actionOwner='deal';assert.equal(probePresentationQuiet(input),false);
});
// The production asynchronous stores on PGlite with the engine's own game DDL.
// One session: this proves the PostgreSQL statements and transaction outcomes,
// not cross-process locking (CI PostgreSQL covers that).
async function fixture(t,{random=()=>0}={}){
  const storage=await createPgliteStore();t.after(()=>storage.close());
  const db=storage.db;
  let time=Date.UTC(2026,8,28),n=0;
  const now=()=>time,memory=await createPlayerChatMemory(db,{now});
  let store=await createPlayerProbeStore(db,memory,{now,random});
  const policy={...createDefaultProbePolicy(),mode:'automatic',probability:1,inactivityMs:1000,cooldownMs:1000};
  const options={owner:'session-A',tab:'tab-A',policy,revision:'r1',quiet:true};
  const observe=(extra={})=>store.observe(scope,{...options,flags:present,...extra});
  await observe();
  return {db,memory,policy,options,now,advance:ms=>time+=ms,observe,get store(){return store;},
    reserve(extra={}){return store.reserve(scope,{...options,requestId:`request-${++n}`,...extra});},
    async restart(){store=await createPlayerProbeStore(db,memory,{now,random});}};
}
test('old projects keep other policies and Probe defaults off; three-way merge preserves independent edits',()=>{
  const base=createSeedProject();delete base.probePolicy;assert.doesNotThrow(()=>validateProject(base));
  const draft=structuredClone(base),remote=structuredClone(base);draft.probePolicy=createDefaultProbePolicy();remote.events[0].label='Remote edit';remote.revision='r2';
  const merged=rebaseProjectDraft(base,draft,remote);assert.equal(merged.conflicts.length,0);assert.equal(merged.project.events[0].label,'Remote edit');assert.equal(merged.project.probePolicy.mode,'off');
});
test('one sample per inactivity, including no, heartbeat, hidden/visible and restart',async t=>{
  let samples=0;const f=await fixture(t,{random:()=>{samples++;return .9;}});f.policy.probability=.3;await f.observe();
  assert.equal((await f.reserve()).reason,'inactive');f.advance(1100);assert.equal((await f.reserve()).reason,'chance');
  await f.observe({flags:{...present,present:false}});await f.observe();await f.restart();
  for(let i=0;i<20;i++)assert.equal((await f.reserve()).reason,'sampled');assert.equal(samples,1);
  await f.observe({activity:true});f.advance(1100);assert.equal((await f.reserve()).reason,'chance');assert.equal(samples,2);
});
test('two tabs, duplicate id, cooldown, hourly and durable failed attempts',async t=>{
  const f=await fixture(t);f.advance(1100);const first=await f.reserve({requestId:'same'});assert.ok(first.ticket);
  await f.observe({tab:'tab-B'});assert.equal((await f.reserve({tab:'tab-B'})).reason,'busy');assert.equal((await f.reserve({requestId:'same'})).reason,'sampled');
  await f.store.finish(scope,first.ticket,'failed');await f.restart();assert.equal((await f.reserve()).reason,'sampled');
  await f.observe({activity:true});assert.equal((await f.reserve()).reason,'inactive');f.policy.inactivityMs=1000;f.policy.cooldownMs=10000;await f.observe();f.advance(1100);assert.equal((await f.reserve()).reason,'cooldown');
  f.advance(10000);await f.observe();const second=await f.reserve();assert.ok(second.ticket);await f.store.finish(scope,second.ticket,'failed');
  f.policy.maxPerHour=2;await f.observe({activity:true});f.advance(11000);await f.observe();assert.equal((await f.reserve()).reason,'hourly');
});
test('activity, policy and presence invalidate pending work without creating another opportunity',async t=>{
  const f=await fixture(t);f.advance(1100);const first=await f.reserve();assert.ok(await f.store.current(scope,{...f.options,ticket:first.ticket}));
  await f.observe({flags:{...present,typing:true}});assert.equal(await f.store.current(scope,{...f.options,ticket:first.ticket}),false);
  await f.observe();assert.equal((await f.reserve()).reason,'sampled');await f.observe({activity:true});f.advance(1100);
  const second=await f.reserve();f.options.revision='r2';await f.observe();assert.equal(await f.store.current(scope,{...f.options,ticket:second.ticket}),false);
});
test('played receipt atomically records one assistant initiative, no invented user entry',async t=>{
  const f=await fixture(t);f.advance(1100);const first=await f.reserve();await f.store.generated(scope,first.ticket,choice);
  assert.equal((await f.memory.profile(scope)).history.length,0);await assert.rejects(f.store.finish(scope,first.ticket,'played'));
  await f.store.finish(scope,first.ticket,'playing');assert.equal(await f.store.finish(scope,first.ticket,'played'),true);
  assert.equal(await f.store.finish(scope,first.ticket,'played'),false);assert.deepEqual((await f.memory.profile(scope)).history,[{role:'assistant',text:choice.text}]);
  const raw=JSON.parse((await f.db.prepare('SELECT history FROM player_chat_memory_profiles').get()).history);assert.equal(raw[0].delivery,'played');assert.equal(raw[0].origin,'probe');
});
async function addPersonal(f){
  for(let i=0;i<8;i++){await f.store.message(scope,`message-${i}`,i===7?'My honeymoon in Lisbon lasts for 15 days.':`I like topic ${i}.`);f.advance(1);}
  const job=await f.store.extraction(scope,f.policy);assert.ok(job);
  const source=job.sources.at(-1);await f.store.saveExtraction(scope,job,[{sourceId:source.id,topicId:'honeymoon',quote:source.text,content:'Honeymoon',expiresAt:f.now()+30*DAY,notBefore:0}],f.policy);
  return job;
}
async function addPersonalSet(f, values, prefix='set-source') {
  for(let i=0;i<8;i++){await f.store.message(scope,`${prefix}-${i}`,values[i]?.quote??`I enjoy fixture ${i}.`);f.advance(1);}
  const job=await f.store.extraction(scope,f.policy);assert.ok(job);
  const proposals=values.map((value,i)=>({sourceId:`${prefix}-${i}`,topicId:value.topicId,quote:value.quote,content:value.quote,expiresAt:f.now()+30*DAY,notBefore:0}));
  await f.store.saveExtraction(scope,job,proposals,f.policy);
  return {job,proposals};
}
async function addLegacyAlias(f, fact) {
  const row=await f.db.prepare('SELECT * FROM player_probe_facts WHERE id=?').get(fact.id);
  await f.db.prepare('INSERT INTO player_probe_facts VALUES(?,?,?,?,?,?,?,?,?)')
    .run(row.scope,'zz-legacy-alias','renamed-topic',row.type,row.content,row.source,row.created,row.expires,row.not_before);
}

test('re-extracting the same source with another topic keeps one fact and its fixed expiry',async t=>{
  const f=await fixture(t),{job,proposals}=await addPersonalSet(f,[{topicId:'guitar',quote:'I am learning guitar.'}]);
  const first=(await f.store.inspect(scope,f.policy)).facts[0];f.advance(1000);
  await f.store.saveExtraction(scope,job,[{...proposals[0],topicId:'learning-guitar',expiresAt:f.now()+30*DAY}],f.policy);
  assert.deepEqual((await f.store.inspect(scope,f.policy)).facts,[first]);
  assert.equal((await f.db.prepare('SELECT count(*) AS n FROM player_probe_facts').get()).n,1);
});

for(const legacy of [false,true])test(`the same source cannot probe again through a renamed topic (legacy receipt: ${legacy})`,async t=>{
  const f=await fixture(t);await addPersonalSet(f,[{topicId:'guitar',quote:'I am learning guitar.'}]);
  const fact=(await f.store.inspect(scope,f.policy)).facts[0];await addLegacyAlias(f,fact);
  assert.equal((await f.store.inspect(scope,f.policy)).facts.length,1);
  await f.observe({activity:true});f.advance(1100);const first=await f.reserve();
  assert.equal(first.memories.length,1);
  await f.store.generated(scope,first.ticket,{speak:true,text:'How is guitar going?',memoryIds:[fact.id],topicId:fact.topicId});
  await f.store.finish(scope,first.ticket,'playing');await f.store.finish(scope,first.ticket,'played');
  // A receipt from before evidence fingerprints carries the column default '[]' (product-schema.sql).
  if(legacy){await f.db.prepare("UPDATE player_probe_attempts SET evidence='[]'").run();await f.restart();}
  else await f.db.prepare('DELETE FROM player_probe_facts WHERE id=?').run(fact.id);
  await f.observe({activity:true});f.advance(1100);
  assert.deepEqual((await f.reserve()).memories,[],'a changed topic cannot bypass the played anecdote cooldown');
});

test('forgetting a visible fact also forgets its hidden legacy aliases',async t=>{
  const f=await fixture(t);await addPersonalSet(f,[{topicId:'dog',quote:'My dog is called Bosse.'}]);
  const fact=(await f.store.inspect(scope,f.policy)).facts[0];await addLegacyAlias(f,fact);
  const before=await f.store.conversation(scope,f.policy);assert.equal(before.context.facts.length,1);
  await f.store.forget(scope,fact.id);
  assert.deepEqual((await f.store.inspect(scope,f.policy)).facts,[]);
  assert.equal((await f.db.prepare('SELECT count(*) AS n FROM player_probe_facts').get()).n,0);
  assert.equal(await f.store.conversationCurrent(scope,before),false);
});

test('ordinary uncertainty, positive actually and memory questions preserve unrelated personal facts',async t=>{
  const f=await fixture(t);await addPersonalSet(f,[{topicId:'dog',quote:'My dog is called Bosse.'},{topicId:'guitar',quote:'I am learning guitar.'}]);
  const before=await f.store.conversation(scope,f.policy);
  for(const [i,message] of ['I actually like guitar.','Actually I like guitar.','I am not sure what to play.','Jag vet inte vad jag ska spela.',"Why don't you remember my dog?"].entries()) {
    await f.store.message(scope,`ordinary-${i}`,message);
    assert.equal(await f.store.conversationCurrent(scope,before),true,message);
  }
  assert.deepEqual((await f.store.conversation(scope,f.policy)).context.facts,before.context.facts);
});

test('an explicit dog-name correction retires only dog evidence and cannot be resurrected by old extraction',async t=>{
  const f=await fixture(t),{job,proposals}=await addPersonalSet(f,[{topicId:'dog',quote:'My dog is called Bosse.'},{topicId:'guitar',quote:'I am learning guitar.'}]);
  const before=await f.store.conversation(scope,f.policy);
  await f.store.message(scope,'dog-correction','Actually my dog is called Luna, not Bosse.');
  assert.deepEqual((await f.store.inspect(scope,f.policy)).facts.map(fact=>fact.topicId),['guitar']);
  assert.equal(await f.store.conversationCurrent(scope,before),false);
  assert.equal(await f.store.saveExtraction(scope,job,proposals,f.policy),false);
  for(let i=0;i<7;i++)await f.store.message(scope,`after-correction-${i}`,`I enjoy test topic ${i}.`);
  f.advance(61000);const next=await f.store.extraction(scope,f.policy);assert.ok(next);
  assert.equal(next.sources.some(source=>source.text.includes('Bosse')&&source.id!=='dog-correction'),false);
  await f.store.saveExtraction(scope,next,[{sourceId:'dog-correction',topicId:'dog-name',quote:'my dog is called Luna',content:'Corrected dog name',notBefore:0,expiresAt:f.now()+30*DAY}],f.policy);
  assert.deepEqual(new Set((await f.store.inspect(scope,f.policy)).facts.map(fact=>fact.source.quote)),new Set(['I am learning guitar.','my dog is called Luna']));
});

test('a new assertion can be saved after the older source expires',async t=>{
  const f=await fixture(t);await addPersonalSet(f,[{topicId:'guitar',quote:'I am learning guitar.'}]);
  const old=(await f.store.inspect(scope,f.policy)).facts[0];f.advance(31*DAY);
  const {job}=await addPersonalSet(f,[{topicId:'learning-guitar',quote:'I am learning guitar.'}],'new-source');
  const fresh=(await f.store.inspect(scope,f.policy)).facts[0];assert.ok(fresh);
  assert.ok(fresh.createdAt>old.expiresAt);assert.ok(fresh.expiresAt>old.expiresAt);
  assert.equal(fresh.source.messageId,job.sources.find(source=>source.text==='I am learning guitar.').id);
});
test('evidence memory is isolated, anchored, fixed TTL and correction/Forget stops resurrection',async t=>{
  const f=await fixture(t),job=await addPersonal(f);let fact=(await f.store.inspect(scope,f.policy)).facts[0];assert.ok(fact);assert.equal(fact.notBefore,fact.createdAt+15*DAY);
  assert.equal((await f.store.inspect({...scope,playerId:'synthetic-bob'},f.policy)).facts.length,0);
  await f.store.message(scope,'ordinary','Thanks!');assert.equal((await f.store.inspect(scope,f.policy)).facts[0].expiresAt,fact.expiresAt);
  await f.store.message(scope,'correction','Actually, my trip was cancelled.');assert.equal((await f.store.inspect(scope,f.policy)).facts.length,0);
  assert.equal(await f.store.saveExtraction(scope,job,[],f.policy),false);
  await f.store.forget(scope);assert.equal(await f.store.saveExtraction(scope,job,[],f.policy),false);
  f.advance(31*DAY);await f.restart();assert.equal((await f.store.inspect(scope,f.policy)).facts.length,0);
});
test('TTL does not extend on reads and expires on restart',async t=>{
  const f=await fixture(t);await addPersonal(f);const expires=(await f.store.inspect(scope,f.policy)).facts[0].expiresAt;
  f.advance(20*DAY);assert.equal((await f.store.inspect(scope,f.policy)).facts[0].expiresAt,expires);
  f.advance(11*DAY);await f.restart();assert.equal((await f.store.inspect(scope,f.policy)).facts.length,0);
});

test('ordinary conversation recalls same-player facts even with Probe off and future proactive timing',async t=>{
  const f=await fixture(t);await addPersonal(f);f.policy.mode='off';
  const saved=await f.store.conversation(scope,f.policy);
  assert.equal(saved.context.facts.length,1);
  assert.deepEqual(saved.context.facts[0],{id:(await f.store.inspect(scope,f.policy)).facts[0].id,topicId:'honeymoon',kind:'player-assertion',
    quote:'My honeymoon in Lisbon lasts for 15 days.',saidAt:f.now()-1,expiresAt:f.now()-1+30*DAY});
  assert.equal(await f.store.conversationCurrent(scope,saved),true);
  assert.equal((await f.store.conversation({...scope,playerId:'another-player'},f.policy)).context.facts.length,0);
  assert.equal((await f.store.conversation({...scope,dealerId:'vera'},f.policy)).context.facts.length,0);
  assert.equal(await f.store.conversationCurrent({...scope,playerId:'another-player'},saved),false);
  assert.equal((await f.store.conversation(scope,{...f.policy,memoryEnabled:false})).context.facts.length,0);
  assert.deepEqual((await f.memory.profile(scope)).history,[],'recall never manufactures a chat turn');
  f.advance(31*DAY);assert.equal(await f.store.conversationCurrent(scope,saved),false);
  assert.equal((await f.store.conversation(scope,f.policy)).context.facts.length,0);
});

test('ordinary conversation snapshots are invalidated by corrections and individual Forget',async t=>{
  const f=await fixture(t);await addPersonal(f);const saved=await f.store.conversation(scope,f.policy);
  await f.store.forget({...scope,playerId:'another-player'});assert.equal(await f.store.conversationCurrent(scope,saved),true);
  await f.store.forget(scope,saved.context.facts[0].id);assert.equal(await f.store.conversationCurrent(scope,saved),false);
  assert.equal((await f.store.conversation(scope,f.policy)).context.facts.length,0);
  f.advance(61000);await addPersonal(f);const replaced=await f.store.conversation(scope,f.policy);
  await f.store.message(scope,'correction-now','Actually, my trip was cancelled.');
  assert.equal(await f.store.conversationCurrent(scope,replaced),false);
  assert.equal((await f.store.conversation(scope,f.policy)).context.facts.length,0);
});

test('conversation memory projects only exact evidence and rejects expired, hidden and oversized data',async t=>{
  const f=await fixture(t);await addPersonal(f);const fact=(await f.store.inspect(scope,f.policy)).facts[0];
  const projected=projectConversationMemory([{...fact,content:'Invented summary',source:{...fact.source,playerId:'never-forward',cookie:'private'}}],f.now());
  assert.equal(JSON.stringify(projected).includes('Invented summary'),false);
  assert.equal(JSON.stringify(projected).includes('never-forward'),false);
  assert.equal(JSON.stringify(projected).includes('private'),false);
  assert.throws(()=>normalizeConversationMemory({...projected,playerId:'untrusted'}),/invalid_conversation_memory/);
  assert.throws(()=>normalizeConversationMemory({asOf:fact.expiresAt,facts:projected.facts}),/invalid_conversation_memory/);
  assert.throws(()=>normalizeConversationMemory({asOf:f.now(),facts:[...projected.facts,...projected.facts]}),/invalid_conversation_memory/);
  const long={...fact,source:{...fact.source,quote:'I'.repeat(550)}};
  const bounded=projectConversationMemory(Array.from({length:40},(_,i)=>({...long,id:`fact-${i}`})),f.now());
  assert.ok(bounded.facts.length<=20);
  assert.ok(Buffer.byteLength(JSON.stringify(bounded))<=CONVERSATION_MEMORY_LIMITS.bytes);
  const hand={handIndex:0,box:0,split:false,cards:[{r:'A',s:'♥'},{r:'10',s:'♠'}],outcome:'win'};
  for(let i=1;i<=2;i++)await f.store.completedRound(scope,{roundId:`round-${i}`,sequence:i,hands:[hand]},f.policy);
  const source=(await f.store.inspect(scope,f.policy)).facts.find(row=>row.type==='hand');
  assert.equal(projectConversationMemory([source],f.now()).facts[0].kind,'completed-server-hands');
  source.source.rounds[0].hands[0].cards[0].faceDown=true;
  assert.equal(projectConversationMemory([source],f.now()).facts.length,0);
});

test('Forget also rejects sources waiting for policy I/O before extraction or hand storage begins',async t=>{
  const f=await fixture(t),waiting=[];
  const runtime=createProbeRuntime({store:f.store,memory:f.memory,projectStore:{load:()=>new Promise(resolve=>waiting.push(resolve))}});
  const source=runtime.rememberMessage(scope,'old-source','My honeymoon is in Lisbon.');
  const round=runtime.completedRound(scope,{roundId:'old-round',sequence:1,hands:[]});
  // Both have read their generation and now wait for policy I/O when Forget lands.
  while(waiting.length<2)await new Promise(resolve=>setImmediate(resolve));
  await runtime.forget(scope);
  waiting.forEach(resolve=>resolve({revision:'r1',probePolicy:f.policy}));await Promise.all([source,round]);
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM player_probe_sources').get()).n,0);
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM player_probe_rounds').get()).n,0);
});
test('only exact consecutive server wins count; duplicate, split and hidden cards do not',async t=>{
  const f=await fixture(t),hand={handIndex:0,box:0,split:false,cards:[{r:'A',s:'♥'},{r:'10',s:'♠'}],outcome:'win'};
  const round=(id,sequence,hands=[hand])=>f.store.completedRound(scope,{roundId:id,sequence,hands},f.policy);
  const facts=async()=>(await f.store.inspect(scope,f.policy)).facts;
  await round('r1',1);await round('r1',1);assert.equal((await facts()).length,0);
  await round('r2',2,[{...hand,split:true}]);await round('r3',3);assert.equal((await facts()).length,0);
  await round('r4',4);const fact=(await facts())[0];assert.ok(fact);assert.deepEqual(fact.source.rounds.map(row=>row.roundId),['r3','r4']);
  await f.store.forget(scope);await round('r5',5,[{...hand,cards:[{r:'A',s:'♥',faceDown:true},{r:'10',s:'♠'}]}]);await round('r6',6);assert.equal((await facts()).length,0);
  await f.store.forget(scope);await round('r10',10);await round('r12',12);assert.equal((await facts()).length,0,'a missing round breaks the claimed sequence');
});
const request=(caseId='name')=>({version:1,requestId:'test-probe',purpose:'probe',model:'gpt-6-luna',reasoning:'gateway-default',context:probeFixtures().find(row=>row.id===caseId).context});
test('30 messages pass; ungrounded, expired, repeated, wrong-card and pressure choices become silence',()=>{
  assert.equal(normalizeProbeRequest(request('thirty-messages')).context.history.length,30);
  assert.equal(validateProbeChoice({...choice,text:'You won with aces twice.'},request('missing-source')).speak,false);
  const personal={...choice,text:'How was your honeymoon?',memoryIds:['memory-trip'],topicId:'honeymoon'};
  for(const id of ['expired','trip-future','repeated'])assert.equal(validateProbeChoice(personal,request(id)).speak,false);
  assert.equal(validateProbeChoice({...choice,text:'Remember those king wins?',memoryIds:['memory-wins'],topicId:'double-win-AhTs'},request('verified-wins')).speak,false);
  assert.equal(validateProbeChoice({...personal,text:'You should bet again.'},request('trip-return')).speak,false);
});
test('model override stays on the no-tools speech role; retries do not charge twice',async()=>{
  let calls=0;
  const service=createProductProbeService({settingsProvider:()=>({speechAgent:'openclaw/croupier-speech',adviceTimeoutMs:3000}),fetchImpl:async(url,options)=>{
    assert.equal(options.headers['x-openclaw-model'],'lab-provider/gpt-6-luna');return 'fake';
  },completeImpl:async(settings,body,timeout,transport)=>{
    calls++;assert.equal(body.model,'openclaw/croupier-speech');assert.equal(body.tool_choice,'none');assert.equal(body.reasoning_effort,undefined);await transport('https://example.invalid',{headers:{}});return JSON.stringify(choice);
  }});
  const input=request();const [a,b]=await Promise.all([service.handle(input),service.handle(input)]);assert.deepEqual(a,b);assert.equal(calls,1);
  await assert.rejects(service.handle({...request(),model:'gpt-5.6-terra'}),/conflict/);
});
test('off/text perform no automatic model or TTS work; changed policy during model skips voice',async t=>{
  const f=await fixture(t);let modelCalls=0,voiceCalls=0,resolveDecision;
  const runtime=createProbeRuntime({store:f.store,memory:f.memory,projectStore:{load:async()=>({revision:f.options.revision,probePolicy:f.policy})},settingsProvider:()=>({}),
    serviceProvider:()=>({generate:async()=>{voiceCalls++;return {};}}),now:f.now,
    decide:async()=>{modelCalls++;return new Promise(resolve=>resolveDecision=resolve);}});
  const body={requestId:'runtime',tab:f.options.tab,sessionRevision:'session',roundRevision:'1'},ctx={owner:f.options.owner,readOwner:()=>f.options.owner,readState:()=>({playerId:scope.playerId,round:null,displayName:'Anna'})};
  for(const mode of ['off','text']){f.policy.mode=mode;assert.equal((await runtime.run(scope,body,ctx)).reason,mode);}
  f.policy.mode='off';assert.equal((await runtime.test(scope,{...body,caseId:'name',model:'gateway-default'},ctx)).reason,'off');
  assert.equal(modelCalls,0);assert.equal(voiceCalls,0);
  f.policy.mode='automatic';await f.observe();f.advance(1100);const work=runtime.run(scope,body,ctx);
  while(!resolveDecision)await new Promise(resolve=>setImmediate(resolve));
  f.options.revision='changed';resolveDecision({choice,metrics:{}});await assert.rejects(work,/stale_probe/);assert.equal(voiceCalls,0);
});

test('requested chat can await cancellation until the low-priority voice job releases its resources',async t=>{
  const f=await fixture(t);let voiceBusy=false;
  const runtime=createProbeRuntime({store:f.store,memory:f.memory,projectStore:{load:async()=>({revision:f.options.revision,probePolicy:f.policy})},
    settingsProvider:()=>({}),now:f.now,decide:async()=>({choice,metrics:{}}),serviceProvider:()=>({generate:({signal})=>new Promise((_resolve,reject)=>{
      voiceBusy=true;signal.addEventListener('abort',()=>setImmediate(()=>{voiceBusy=false;reject(new Error('cancelled'));}),{once:true});
    })})});
  f.advance(1100);
  const work=runtime.run(scope,{requestId:'cancel-for-chat',tab:f.options.tab,sessionRevision:'s',roundRevision:'1'},
    {owner:f.options.owner,readOwner:()=>f.options.owner,readState:()=>({playerId:scope.playerId,round:null,displayName:'Anna'})});
  const rejected=assert.rejects(work,/cancelled/);
  while(!voiceBusy)await new Promise(resolve=>setImmediate(resolve));
  await runtime.cancel(scope,'chat');await rejected;
  assert.equal(voiceBusy,false);assert.equal((await f.memory.profile(scope)).history.length,0);
  assert.equal((await f.store.inspect(scope,f.policy)).latest.state,'cancelled');
});
