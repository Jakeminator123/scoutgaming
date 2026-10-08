import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OpenClaw,speechStatus} from '../server/openclaw.mjs';
import {RESPONSES} from '../server/dealer-policy.mjs';
import {classifyManifest} from '../server/media-registry.mjs';
import {integrationIndex,eventEvidence} from '../server/integration-index.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const choice=(envelope,extra={})=>({kind:'recordedLine',requestId:envelope.request.requestId,dealerId:'astrid',sessionRevision:envelope.status.sessionRevision,roundRevision:envelope.status.roundRevision,lineId:'social',variantId:null,...extra});
function adapter(make){return new OpenClaw({url:'https://director.example',token:'private',fetchImpl:async(url,opts)=>new Response(JSON.stringify(make(JSON.parse(opts.body),url,opts)))});}
test('OpenClaw sends bounded public status and only releases exact approved text',async()=>{
 let observed;const a=adapter((e,url,opts)=>{observed=e;assert.equal(opts.redirect,'error');return choice(e);});
 assert.equal(await a.reply({text:'Good evening',context:{sessionRevision:'7',roundRevision:'r1',secret:'hidden shoe'}}),RESPONSES.social);
 assert.equal(observed.status.sessionRevision,'7');assert.deepEqual(observed.status.visibleCards.hands,[]);assert.ok(!JSON.stringify(observed).includes('hidden shoe'));assert.equal(observed.status.allowedSpeech.generatedText,false);
});
test('rejects stale, arbitrary text, extra keys, variant injection and echoed revision mismatch',async()=>{
 for(const extra of [{kind:'generatedText',text:'Bet more'}, {url:'https://evil.test'}, {variantId:'unknown'}, {roundRevision:'other'}, {lineId:'unknown'}]){
  assert.equal(await adapter(e=>choice(e,extra)).reply({text:'Good evening'}),RESPONSES.fallback);
 }
 let version=0;const a=adapter(e=>{version++;return choice(e);});
 assert.equal(await a.reply({text:'Good evening',getContext:()=>({sessionRevision:String(version)})}),RESPONSES.fallback);
});
test('local safety bypasses provider, silence is preserved and failures fail closed',async()=>{
 const a=adapter(()=>{throw Error('must not run');});assert.equal(await a.reply({text:'I lost my rent money'}),RESPONSES.support);
 const silent=adapter(e=>{const c=choice(e,{kind:'silence'});delete c.lineId;delete c.variantId;return c;});assert.equal(await silent.reply({text:'Good evening'}),null);
 assert.equal(await a.reply({text:'Good evening'}),RESPONSES.fallback);
 assert.throws(()=>new OpenClaw({url:'http://external.test',token:'secret'}));
});
test('index excludes legacy bindings and evidence excludes private payloads',()=>{
 const {registry}=classifyManifest(JSON.parse(readFileSync(new URL('../public/media/manifest.json',import.meta.url))));const index=integrationIndex(registry);
 for(const m of registry.filter(m=>m.category==='legacy_training'))assert.ok(!index.edges.some(e=>e.to==='clip:'+m.id));
 const evidence=eventEvidence({events:[{seq:1,type:'engine.start',payload:{draws:['secret'],name:'private'},parent:null},{seq:2,type:'presentation.plan',payload:{planId:'p1',steps:[{clip:{id:'win',url:'private'},startAt:1,endAt:2}]},parent:1}]});
 assert.ok(!JSON.stringify(evidence).includes('private'));assert.equal(evidence[1].status,'scheduled');assert.equal(evidence[1].parent,1);
 assert.equal(speechStatus().allowedSpeech.silence,true);
});
test('real MCP stdio client discovers index, searches events and fails closed without game credentials',async()=>{
 const client=new Client({name:'integration-test',version:'1'});
 const transport=new StdioClientTransport({command:process.execPath,args:['server/mcp.mjs'],cwd:new URL('..',import.meta.url).pathname,env:{PATH:process.env.PATH}});
 try{
  await client.connect(transport);const tools=await client.listTools();assert.deepEqual(tools.tools.map(t=>t.name),['search_integration','read_event_trace']);
  const resources=await client.listResources();assert.equal(resources.resources[0].uri,'croupier://integration/index');
  const resource=await client.readResource({uri:'croupier://integration/index'});assert.ok(JSON.parse(resource.contents[0].text).revision);
  const result=await client.callTool({name:'search_integration',arguments:{query:'blackjack'}});assert.ok(JSON.parse(result.content[0].text).nodes.length>0);
  assert.equal((await client.callTool({name:'read_event_trace',arguments:{room:'astrid'}})).isError,true);
 }finally{await client.close();}
});
test('Astrid routes the OpenClaw choice through exact TTS and skips synthesis on silence',async()=>{
 const {Astrid}=await import('../server/astrid.mjs');
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'openclaw-pipeline-'));const spoken=[];
 try{
  const a=new Astrid({llm:adapter(e=>choice(e)),tts:{say:async text=>{spoken.push(text);return Buffer.from('pcm');}},lipsync:async()=>({mp4:Buffer.from('fixture'),meta:{dur:1}}),answersDir:dir});
  const result=await a.enqueue({kind:'chat',text:'Good evening',getContext:()=>({sessionRevision:'9'})});assert.equal(result.text,RESPONSES.social);assert.deepEqual(spoken,[RESPONSES.social]);
  a.llm=adapter(e=>{const c=choice(e,{kind:'silence'});delete c.lineId;delete c.variantId;return c;});
  const silent=await a.enqueue({kind:'chat',text:'Good evening'});assert.equal(silent.silent,true);assert.equal(spoken.length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
