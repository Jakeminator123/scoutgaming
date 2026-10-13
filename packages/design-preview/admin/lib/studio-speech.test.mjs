import test from 'node:test';
import assert from 'node:assert/strict';
import {SPEECH_LINES} from '../../../../web/public/speech-lines.mjs';
import {STUDIO_SPEECH_LINES,STUDIO_ASTRID_VOICE,studioSpeechLineIds,studioSpeechLines,studioSpeechBuildCompatibility,applyStudioSpeechProfile,studioSpeechMediaUrl} from './studio-speech.mjs';

test('17 explicit SV/EN generation templates preserve authoritative English captions',()=>{
  assert.equal(STUDIO_SPEECH_LINES.length,17);assert.deepEqual(Object.fromEntries(studioSpeechLines('en').map(row=>[row.id,row.exactText])),SPEECH_LINES);
  const sv=studioSpeechLines('sv');assert.equal(sv.length,17);for(const row of sv){assert.ok(row.exactText);assert.notEqual(row.exactText,SPEECH_LINES[row.id]);}
  for(const [language,ids]of [['de',['goodluck']],['sv',['missing']],['sv',[]],['sv',['goodluck','goodluck']]])assert.throws(()=>studioSpeechLines(language,ids));
});
test('no dealer alias or foreign voice inherits Astrid Victoria fullfile identity',()=>{
  assert.equal(STUDIO_ASTRID_VOICE.name,'Victoria');assert.equal(STUDIO_ASTRID_VOICE.voiceId,'dc30854e-e398-4579-9dc8-16f6cb2c19b9');
  const project={dealers:[{id:'astrid'},{id:'viktoria'},{id:'paow'}]};assert.equal(studioSpeechBuildCompatibility(project,'astrid').supported,true);
  for(const id of ['viktoria','paow','unknown'])assert.equal(studioSpeechBuildCompatibility(project,id).supported,false);
  for(const speechProfile of [{voice:{provider:'elevenlabs',voiceId:'foreign',modelId:'eleven_v3'}},{voice:{provider:'cartesia',voiceId:STUDIO_ASTRID_VOICE.voiceId,modelId:STUDIO_ASTRID_VOICE.modelId},reference:{videoId:'custom'}}])assert.equal(studioSpeechBuildCompatibility({dealers:[{id:'astrid',speechProfile}]},'astrid').supported,false);
});
test('profile edit keeps exact dealer-bound source hash and excludes credentials',()=>{
  const project={dealers:[{id:'astrid'},{id:'paow'}]},video={id:'own-idle',dealer:'paow',available:true,integrity:'verified',bytes:100,sha256:'a'.repeat(64),duration:3};
  const profile={schemaVersion:2,state:'preparation',voice:{provider:'elevenlabs',voiceId:'own-voice',modelId:'eleven_v3'},reference:{kind:'video-frame',videoId:video.id,sha256:video.sha256,offsetMs:200}};
  const result=applyStudioSpeechProfile(project,{videos:[video]},'paow',profile);assert.equal(project.dealers[1].speechProfile,undefined);assert.equal(result.dealers[0],project.dealers[0]);assert.deepEqual(result.dealers[1].speechProfile,profile);
  for(const patch of [{dealer:'astrid'},{sha256:'b'.repeat(64)},{available:false},{classification:{archived:true}}])assert.throws(()=>applyStudioSpeechProfile(project,{videos:[{...video,...patch}]},'paow',profile));
  assert.throws(()=>applyStudioSpeechProfile(project,{videos:[video]},'paow',{...profile,voice:{...profile.voice,apiKey:'secret'}}));
});
test('media previews reject arbitrary providers, cross-origin and credential links',()=>{
  assert.equal(studioSpeechMediaUrl('/studio/api/speech-build?media='+'a'.repeat(32)+'&kind=video'),'/studio/api/speech-build?media='+'a'.repeat(32)+'&kind=video');
  for(const value of ['https://provider.invalid/file','//outside.invalid','/api/voice/private','/studio/api/videos/id?token=secret','javascript:alert(1)','/studio/api/speech-build?media='+'a'.repeat(32)+'&kind=video&token=secret'])assert.equal(studioSpeechMediaUrl(value),null);
});

async function panelHarness(){
  const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild'),helpers=await import('./studio-speech.mjs'),profile=await import('../../../../web/public/dealer-speech-profile.mjs');
  const source=readFileSync(new URL('../components/studio/studio-speech-panel.tsx',import.meta.url),'utf8'),output=transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}),slots=[],effects=[];
  let cursor=0,queue=[],calls=[];const module={exports:{}};
  const fakeReact={...React,useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next}]},useRef(initial){const index=cursor++;return slots[index]??={current:initial}},useEffect(effect,deps){const index=cursor++,previous=effects[index];if(!previous||deps.some((value,i)=>!Object.is(value,previous.deps[i])))queue.push({index,effect,deps})}};
  runInNewContext(output.code,{module,exports:module.exports,require:name=>name==='react'?fakeReact:name.includes('studio-speech.mjs')?helpers:name.includes('dealer-speech-profile.mjs')?profile:require(name),AbortController,fetch:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({plan:{dealerId:'astrid',revision:'r2',configured:false,lines:[],voice:STUDIO_ASTRID_VOICE}})}}});
  const props={project:{schemaVersion:1,revision:'r1',dealers:[{id:'astrid',label:'Astrid'}]},inventory:{videos:[]},dealerId:'astrid',blocked:false,projectDirty:true,onEdit:next=>{props.project=next},onDirtyChange:dirty=>{props.profileDirty=dirty}};
  const render=()=>{cursor=0;return module.exports.StudioSpeechPanel(props)},flush=()=>{const pending=queue;queue=[];for(const item of pending){effects[item.index]?.cleanup?.();effects[item.index]={deps:item.deps,cleanup:item.effect()}}};
  const nodes=(node,predicate)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(child=>nodes(child,predicate)):[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];
  const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
  const field=(tree,label)=>nodes(nodes(tree,node=>node.type==='label'&&text(node).startsWith(label))[0],node=>['input','select'].includes(node.type))[0];
  const button=(tree,label)=>nodes(tree,node=>node.type==='button'&&text(node).startsWith(label))[0];
  return {props,render,flush,field,button,nodes,calls};
}
test('speech profile stages while shared project is dirty; generation waits for a saved revision',async()=>{
  const h=await panelHarness();h.render();h.flush();let tree=h.render();
  h.field(tree,'Röstleverantör').props.onChange({target:{value:'cartesia'}});tree=h.render();h.field(tree,'Röstmodell').props.onChange({target:{value:STUDIO_ASTRID_VOICE.modelId}});tree=h.render();h.field(tree,'Voice-ID').props.onChange({target:{value:STUDIO_ASTRID_VOICE.voiceId}});tree=h.render();h.flush();tree=h.render();
  assert.equal(h.props.profileDirty,true);assert.equal(h.button(tree,'Lägg talprofil').props.disabled,false);assert.equal(h.nodes(tree,node=>node.type==='fieldset')[0].props.disabled,false);
  assert.equal(h.button(tree,'Förbered').props.disabled,true);h.button(tree,'Förbered').props.onClick();assert.equal(h.calls.length,0);
  h.button(tree,'Lägg talprofil').props.onClick();tree=h.render();h.flush();tree=h.render();h.flush();assert.equal(h.props.project.dealers[0].speechProfile.voice.voiceId,STUDIO_ASTRID_VOICE.voiceId);assert.equal(h.props.profileDirty,false);
  h.props.projectDirty=false;tree=h.render();h.flush();tree=h.render();assert.equal(h.button(tree,'Förbered').props.disabled,true,'staging alone is not a saved server revision');
  h.props.project={...h.props.project,revision:'r2'};tree=h.render();h.flush();tree=h.render();assert.equal(h.button(tree,'Förbered').props.disabled,false);
});
test('unrelated project revision does not erase unstaged voice fields',async()=>{
  const h=await panelHarness();h.render();h.flush();let tree=h.render();h.field(tree,'Voice-ID').props.onChange({target:{value:'own-unsaved-voice'}});tree=h.render();h.flush();assert.equal(h.props.profileDirty,true);
  h.props.project={...h.props.project,revision:'unrelated-r2',clipLabels:{'other-clip':'New label'}};tree=h.render();h.flush();tree=h.render();assert.equal(h.field(tree,'Voice-ID').props.value,'own-unsaved-voice');assert.equal(h.button(tree,'Förbered').props.disabled,true);
});
test('roulette selects only unchanged game-neutral SV/EN library captions; Blackjack keeps 17',()=>{
  assert.deepEqual(studioSpeechLineIds('roulette'),['placebets','goodluck','chatter2','farewell']);
  assert.deepEqual(studioSpeechLineIds('blackjack'),Object.keys(SPEECH_LINES));assert.equal(studioSpeechLineIds().length,17);
  assert.throws(()=>studioSpeechLineIds('poker'));
  for(const language of ['sv','en'])for(const row of studioSpeechLines(language,studioSpeechLineIds('roulette'))){assert.equal(row.exactText,STUDIO_SPEECH_LINES.find(item=>item.id===row.id)[language]);assert.doesNotMatch(row.exactText,/blackjack|cards|korten|försäkring|insurance|doubl|dubbl|hand|tjugoett/i);}
  assert.equal(studioSpeechLines('en',['greeting'])[0].exactText,SPEECH_LINES.greeting);assert.equal(studioSpeechLines('sv',['greeting'])[0].exactText,'Välkommen till Privé Blackjack. Slå dig ner, jag är din dealer i kväll.');assert.equal(studioSpeechLines('en',['chatter1'])[0].exactText,SPEECH_LINES.chatter1);
});
test('roulette UI resets unsupported selection and all-line preparation sends exactly the neutral subset',async()=>{
  const h=await panelHarness();h.props.projectDirty=false;h.render();h.flush();let tree=h.render();h.field(tree,'Replikplats').props.onChange({target:{value:'insurance'}});tree=h.render();
  h.props.game='roulette';tree=h.render();h.flush();tree=h.render();const select=h.field(tree,'Biblioteksreplik');assert.equal(select.props.value,'placebets');assert.deepEqual(h.nodes(select,node=>node.type==='option').map(node=>node.props.value),studioSpeechLineIds('roulette'));
  const headings=h.nodes(tree,node=>node.type==='h3').map(node=>node.props.children.flat().join(''));assert.ok(headings.some(text=>text.includes('Gemensamt talbibliotek')&&text.includes('4')));
  const all=h.field(tree,'Förbered alla');all.props.onChange({target:{checked:true}});tree=h.render();h.flush();tree=h.render();assert.equal(h.button(tree,'Förbered 4 talset').props.disabled,false);h.button(tree,'Förbered 4 talset').props.onClick();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls.length,1);const request=JSON.parse(h.calls[0].init.body);assert.equal(request.operation,'prepare');assert.deepEqual(request.lineIds,studioSpeechLineIds('roulette'));assert.equal(request.language,'sv');
});
