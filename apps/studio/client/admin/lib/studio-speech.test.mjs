import test from 'node:test';
import assert from 'node:assert/strict';
import {SPEECH_LINES} from '../../../../../packages/presentation/contracts/speech-lines.mjs';
import {STUDIO_SPEECH_LINES,STUDIO_ASTRID_VOICE,studioSpeechLineIds,studioSpeechLines,studioSpeechBuildCompatibility,applyStudioSpeechProfile,studioSpeechMediaUrl,studioRecordedSpeech} from '../../../../../packages/presentation/contracts/studio-speech.mjs';
import {initialDealerVoiceDraft,dealerVoiceDraft,dealerVoicePreset} from '../../../../../packages/presentation/contracts/dealer-voice-catalog.mjs';

test('confirmed original voice defaults preserve saved choices and refuse ambiguous or approximate names',()=>{
  for(const [dealer,id] of [[{id:'paow'},'paow'],[{id:'body-7',label:' PAOW '},'paow'],[{id:'dragan'},'dragge'],[{id:'body-8',label:'Dragge'},'dragge']]) {
    assert.deepEqual(initialDealerVoiceDraft(dealer,null),dealerVoiceDraft(dealerVoicePreset(id)));
    const own={provider:'elevenlabs',voiceId:'explicit-own-voice',modelId:'own-model'};
    assert.deepEqual(initialDealerVoiceDraft(dealer,own),dealerVoiceDraft(own));
  }
  for(const dealer of [undefined,{id:'astrid'},{id:'paow',label:'Dragge'},{id:'body-7',label:'Paow copy'},{id:'unknown'}])assert.deepEqual(initialDealerVoiceDraft(dealer,null),dealerVoiceDraft(null));
});

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
  const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild'),helpers=await import('../../../../../packages/presentation/contracts/studio-speech.mjs'),profile=await import('../../../../../packages/presentation/contracts/dealer-speech-profile.mjs'),voices=await import('../../../../../packages/presentation/contracts/dealer-voice-catalog.mjs');
  const pickerModule={exports:{}},pickerSource=readFileSync(new URL('../../../components/dealer-voice-picker.tsx',import.meta.url),'utf8');
  runInNewContext(transformSync(pickerSource,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module:pickerModule,exports:pickerModule.exports,require:name=>name.includes('dealer-voice-catalog.mjs')?voices:require(name)});
  const {DealerVoicePicker}=pickerModule.exports;
  const source=readFileSync(new URL('../components/studio/studio-speech-panel.tsx',import.meta.url),'utf8'),output=transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}),slots=[],effects=[];
  let cursor=0,queue=[],calls=[];const module={exports:{}};
  const fakeReact={...React,useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next}]},useRef(initial){const index=cursor++;return slots[index]??={current:initial}},useEffect(effect,deps){const index=cursor++,previous=effects[index];if(!previous||deps.some((value,i)=>!Object.is(value,previous.deps[i])))queue.push({index,effect,deps})}};
  runInNewContext(output.code,{module,exports:module.exports,require:name=>name==='react'?fakeReact:name.includes('dealer-voice-picker')?{DealerVoicePicker}:name.includes('dealer-voice-catalog.mjs')?voices:name.includes('studio-speech.mjs')?helpers:name.includes('dealer-speech-profile.mjs')?profile:require(name),AbortController,fetch:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({plan:{dealerId:'astrid',revision:'r2',configured:false,lines:[],voice:STUDIO_ASTRID_VOICE}})}}});
  const props={project:{schemaVersion:1,revision:'r1',dealers:[{id:'astrid',label:'Astrid'}]},inventory:{videos:[]},dealerId:'astrid',blocked:false,projectDirty:true,onEdit:next=>{props.project=next},onDirtyChange:dirty=>{props.profileDirty=dirty}};
  const render=()=>{cursor=0;return module.exports.StudioSpeechPanel(props)},flush=()=>{const pending=queue;queue=[];for(const item of pending){effects[item.index]?.cleanup?.();effects[item.index]={deps:item.deps,cleanup:item.effect()}}};
  const nodes=(node,predicate)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(child=>nodes(child,predicate)):node.type===DealerVoicePicker?nodes(DealerVoicePicker(node.props),predicate):[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];
  const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
  const field=(tree,label)=>nodes(nodes(tree,node=>node.type==='label'&&text(node).trimStart().startsWith(label))[0],node=>['input','select'].includes(node.type))[0];
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

for(const game of ['blackjack','roulette'])test(`${game} body dealer defaults to the confirmed original voice without activation or generation`,async()=>{
  const h=await panelHarness();h.props.game=game;h.props.dealerId='body-7';h.props.project={...h.props.project,dealers:[{id:'body-7',label:'Paow'}]};
  h.render();h.flush();let tree=h.render();h.flush();
  assert.equal(h.field(tree,'Röst').props.value,'paow','the explicit pairing needs no extra voice menu');
  assert.equal(h.props.profileDirty,false,'an untouched voice proposal must not block navigation');
  assert.equal(h.button(tree,'Lägg talprofil').props.disabled,false,'the proposal can still be deliberately staged');
  assert.equal(h.button(tree,'Förbered').props.disabled,true,'the suggestion is not a saved profile');
  assert.equal(h.props.project.dealers[0].speechProfile,undefined,'opening does not mutate the saved project');
  assert.equal(h.field(tree,'Voice-ID').props.value,'WZVEBKUreb9jAKojf0QF');assert.equal(h.field(tree,'Röstmodell').props.value,'eleven_v3');
  assert.equal(h.field(tree,'Stabilitet').props.value,'0.5');assert.equal(h.field(tree,'Begär AI-tal').props.checked,false);
  assert.equal(h.nodes(tree,node=>node.type==='details'&&node.props.open===true).length,0,'known voice details stay compact');
  h.field(tree,'Röstspråk').props.onChange({target:{value:'en'}});tree=h.render();
  assert.equal(h.field(tree,'Röstmodell').props.value,'eleven_multilingual_v2');assert.equal(h.field(tree,'Stil').props.value,'0.3');
  h.button(tree,'Lägg talprofil').props.onClick();tree=h.render();h.flush();tree=h.render();
  const profile=h.props.project.dealers[0].speechProfile;
  assert.equal(profile.state,'preparation');assert.equal(profile.reference,null);assert.equal(profile.voice.language,'en');assert.equal(profile.voice.settings.stability,.38);
  assert.equal(h.calls.length,0,'choosing and saving a preset makes no provider/build request');
  h.field(tree,'Röst').props.onChange({target:{value:'dragge'}});tree=h.render();
  assert.equal(h.field(tree,'Voice-ID').props.value,'7f95xPL4S3ySZ4OS1pw8');assert.equal(h.field(tree,'Stil').props.value,'0.15');
  h.field(tree,'Voice-ID').props.onChange({target:{value:'other-owned-voice'}});tree=h.render();
  assert.equal(h.field(tree,'Egna röstinställningar').props.checked,false,'another voice never inherits the original clone tuning');
});

test('switching dealers refreshes the default and keeps an existing explicit voice',async()=>{
  const h=await panelHarness();h.props.project.dealers=[{id:'paow',label:'Paow'},{id:'dragge',label:'Dragge'},{id:'custom',label:'Paow',speechProfile:{schemaVersion:2,state:'preparation',voice:{provider:'elevenlabs',voiceId:'custom-id',modelId:'custom-model'},reference:null}}];
  for(const [id,expected] of [['paow','WZVEBKUreb9jAKojf0QF'],['dragge','7f95xPL4S3ySZ4OS1pw8'],['custom','custom-id']]){
    h.props.dealerId=id;h.render();h.flush();const tree=h.render();
    assert.equal(h.field(tree,'Voice-ID').props.value,expected);
    assert.equal(h.field(tree,'Begär AI-tal').props.checked,false);
  }
  assert.equal(h.calls.length,0);
});

for(const [label,target] of [['Röst',{value:'paow'}],['Röstspråk',{value:'en'}],['Voice-ID',{value:'user-edited-voice'}],['Röstmodell',{value:'user-edited-model'}],['Stabilitet',{value:'0.6'}],['Egna röstinställningar',{checked:false}]])test(`Dragan voice proposal is clean but a real ${label} change remains protected`,async()=>{
  const h=await panelHarness();h.props.projectDirty=false;h.props.dealerId='dragan';h.props.project={...h.props.project,dealers:[{id:'dragan',label:'Dragan'}]};
  const initial=structuredClone(h.props.project);h.render();h.flush();let tree=h.render();h.flush();
  assert.equal(h.props.profileDirty,false);assert.equal(h.field(tree,'Röst').props.value,'dragge');
  h.field(tree,label).props.onChange({target});tree=h.render();h.flush();tree=h.render();
  assert.equal(h.props.profileDirty,true);assert.equal(h.button(tree,'Förbered').props.disabled,true);
  assert.deepEqual(h.props.project,initial);assert.equal(h.calls.length,0,'a form edit cannot start provider work or save a profile');
});

test('changing only a voice preserves an unchanged own reference; replaced bytes require a fresh preview',async()=>{
  const h=await panelHarness(),ref={kind:'video-frame',videoId:'paow-idle',sha256:'a'.repeat(64),offsetMs:200};
  h.props.dealerId='paow';h.props.project={...h.props.project,dealers:[{id:'paow',label:'Paow',speechProfile:{schemaVersion:2,state:'preparation',voice:{provider:'elevenlabs',voiceId:'older',modelId:'eleven_v3'},reference:ref}}]};
  h.props.inventory.videos=[{id:ref.videoId,dealer:'paow',available:true,bytes:100,sha256:ref.sha256}];
  h.render();h.flush();let tree=h.render();h.field(tree,'Röst').props.onChange({target:{value:'paow'}});tree=h.render();
  assert.equal(h.button(tree,'Lägg talprofil').props.disabled,false);h.button(tree,'Lägg talprofil').props.onClick();
  assert.deepEqual(h.props.project.dealers[0].speechProfile.reference,ref);
  tree=h.render();h.flush();tree=h.render();h.props.inventory.videos[0].sha256='b'.repeat(64);tree=h.render();
  h.field(tree,'Röst').props.onChange({target:{value:'dragge'}});tree=h.render();assert.equal(h.button(tree,'Lägg talprofil').props.disabled,true);
  h.button(tree,'Lägg talprofil').props.onClick();assert.equal(h.props.project.dealers[0].speechProfile.voice.voiceId,'WZVEBKUreb9jAKojf0QF');
});

async function referencePanel(kind,state='preparation') {
  const h=await panelHarness(),reference={kind,videoId:'dragan-reference',sha256:'a'.repeat(64),offsetMs:200};
  h.props.dealerId='dragan';h.props.projectDirty=false;
  h.props.project={...h.props.project,dealers:[{id:'dragan',label:'Dragan',speechProfile:{schemaVersion:2,state,
    voice:{provider:'elevenlabs',voiceId:'own-voice',modelId:'eleven_v3'},reference}}]};
  h.props.inventory.videos=[{id:reference.videoId,dealer:'dragan',available:true,bytes:100,sha256:reference.sha256,duration:3,previewUrl:'/studio/api/videos/dragan-reference'}];
  h.render();h.flush();h.render();h.flush();
  return h;
}
function reviewReference(h) {
  const node=h.nodes(h.render(),row=>row.type==='video')[0];
  node.props.ref.current={duration:3,currentTime:0,readyState:2,seeking:false,pause(){}};
  node.props.onLoadedMetadata();node.props.onSeeked();
  return h.render();
}
for(const kind of ['motion-video','video-frame'])for(const change of ['offset','source','bytes'])test(`${kind} reference ${change} edit preserves its mode after a fresh preview`,async()=>{
  const h=await referencePanel(kind),before=structuredClone(h.props.project);let tree=h.render();
  if(change==='offset')h.field(tree,'Referensposition').props.onChange({target:{value:'400'}});
  if(change==='source'){
    h.props.inventory.videos.push({...h.props.inventory.videos[0],id:'dragan-new',sha256:'b'.repeat(64),previewUrl:'/studio/api/videos/dragan-new'});
    tree=h.render();h.field(tree,'Dealerns egen referensvideo').props.onChange({target:{value:'dragan-new'}});
  }
  if(change==='bytes'){
    h.props.inventory.videos[0].sha256='b'.repeat(64);
    h.field(tree,'Referensposition').props.onChange({target:{value:'400'}});
  }
  tree=h.render();h.flush();tree=h.render();
  assert.equal(h.button(tree,'Lägg talprofil').props.disabled,true,'changed source/time requires review');
  h.button(tree,'Lägg talprofil').props.onClick();assert.deepEqual(h.props.project,before);
  tree=reviewReference(h);
  assert.equal(h.button(tree,'Lägg talprofil').props.disabled,false);
  assert.equal(h.field(tree,'Begär AI-tal').props.disabled,kind==='motion-video','editing a motion reference cannot unlock still-frame activation');
  h.button(tree,'Lägg talprofil').props.onClick();
  const saved=h.props.project.dealers[0].speechProfile;
  assert.deepEqual(saved.reference,{kind,videoId:change==='source'?'dragan-new':'dragan-reference',sha256:(change==='offset'?'a':'b').repeat(64),offsetMs:change==='source'?200:400});
  assert.deepEqual(saved.voice,before.dealers[0].speechProfile.voice);assert.equal(saved.state,'preparation');
  assert.equal(h.calls.length,0,'staging a reference cannot start generation');
});

for(const change of ['offset','source','bytes'])test(`enabled motion ${change} edit requires explicit deactivation before staging`,async()=>{
  const h=await referencePanel('motion-video','enabled'),before=structuredClone(h.props.project);let tree=h.render();
  if(change==='offset')h.field(tree,'Referensposition').props.onChange({target:{value:'400'}});
  if(change==='source'){
    h.props.inventory.videos.push({...h.props.inventory.videos[0],id:'dragan-new',sha256:'b'.repeat(64),previewUrl:'/studio/api/videos/dragan-new'});
    tree=h.render();h.field(tree,'Dealerns egen referensvideo').props.onChange({target:{value:'dragan-new'}});
  }
  if(change==='bytes')h.props.inventory.videos[0].sha256='b'.repeat(64);
  tree=h.render();h.flush();tree=reviewReference(h);
  assert.equal(h.button(tree,'Lägg talprofil').props.disabled,true);
  h.button(tree,'Lägg talprofil').props.onClick();assert.deepEqual(h.props.project,before);
  assert.equal(h.button(tree,'Förbered').props.disabled,true);
  h.field(tree,'Begär AI-tal').props.onChange({target:{checked:false}});tree=h.render();
  assert.equal(h.button(tree,'Lägg talprofil').props.disabled,false);
  h.button(tree,'Lägg talprofil').props.onClick();
  const saved=h.props.project.dealers[0].speechProfile;
  assert.equal(saved.state,'preparation');assert.equal(saved.reference.kind,'motion-video');
  assert.equal(saved.reference.videoId,change==='source'?'dragan-new':'dragan-reference');
  assert.equal(saved.reference.sha256,(change==='offset'?'a':'b').repeat(64));
  assert.equal(saved.reference.offsetMs,change==='offset'?400:200);assert.equal(h.calls.length,0);
});

test('voice-only editing preserves enabled motion identity without another preview',async()=>{
  const h=await referencePanel('motion-video','enabled'),reference=structuredClone(h.props.project.dealers[0].speechProfile.reference);let tree=h.render();
  h.field(tree,'Voice-ID').props.onChange({target:{value:'other-voice'}});tree=h.render();
  assert.equal(h.button(tree,'Lägg talprofil').props.disabled,false);h.button(tree,'Lägg talprofil').props.onClick();
  assert.deepEqual(h.props.project.dealers[0].speechProfile.reference,reference);
  assert.equal(h.props.project.dealers[0].speechProfile.state,'enabled');assert.equal(h.calls.length,0);
});

test('an enabled motion reference can still be turned off without changing its identity',async()=>{
  const h=await referencePanel('motion-video','enabled'),before=structuredClone(h.props.project.dealers[0].speechProfile);let tree=h.render();
  assert.equal(h.field(tree,'Begär AI-tal').props.disabled,false);
  h.field(tree,'Begär AI-tal').props.onChange({target:{checked:false}});tree=h.render();
  h.button(tree,'Lägg talprofil').props.onClick();
  assert.deepEqual(h.props.project.dealers[0].speechProfile,{...before,state:'preparation'});assert.equal(h.calls.length,0);
});

for(const failure of ['alpha','decode'])test(`admin blocks ${failure} reference even when it was already saved as enabled`,async()=>{
  const h=await panelHarness(),ref={kind:'video-frame',videoId:'paow-idle',sha256:'a'.repeat(64),offsetMs:200};
  h.props.dealerId='paow';h.props.project={...h.props.project,dealers:[{id:'paow',label:'Paow',speechProfile:{schemaVersion:2,state:'enabled',voice:{provider:'elevenlabs',voiceId:'older',modelId:'eleven_v3'},reference:ref}}]};
  h.props.inventory.videos=[{id:ref.videoId,dealer:'paow',available:true,bytes:100,sha256:ref.sha256,previewUrl:'/studio/api/videos/paow-idle',...(failure==='alpha'?{compositing:{mode:'alpha'}}:{})}];
  h.render();h.flush();let tree=h.render();
  h.field(tree,'Röst').props.onChange({target:{value:'paow'}});tree=h.render();
  if(failure==='decode'){h.nodes(tree,node=>node.type==='video')[0].props.onError();tree=h.render();}
  assert.equal(h.button(tree,'Lägg talprofil').props.disabled,true);
  h.button(tree,'Lägg talprofil').props.onClick();assert.equal(h.props.project.dealers[0].speechProfile.voice.voiceId,'older');
  assert.equal(h.field(tree,'Begär AI-tal').props.disabled,false,'turning an incompatible profile off remains possible');
  h.field(tree,'Begär AI-tal').props.onChange({target:{checked:false}});tree=h.render();
  assert.equal(h.button(tree,'Lägg talprofil').props.disabled,false);
  h.button(tree,'Lägg talprofil').props.onClick();assert.equal(h.props.project.dealers[0].speechProfile.state,'preparation');
  assert.equal(h.calls.length,0);
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
  const headings=h.nodes(tree,node=>node.type==='h3').map(node=>[node.props.children].flat().join(''));assert.ok(headings.some(text=>text.includes('Ny generering')&&text.includes('4')));
  const all=h.field(tree,'Förbered alla');all.props.onChange({target:{checked:true}});tree=h.render();h.flush();tree=h.render();assert.equal(h.button(tree,'Förbered 4 talset').props.disabled,false);h.button(tree,'Förbered 4 talset').props.onClick();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls.length,1);const request=JSON.parse(h.calls[0].init.body);assert.equal(request.operation,'prepare');assert.deepEqual(request.lineIds,studioSpeechLineIds('roulette'));assert.equal(request.language,'sv');
});

function recordingFixture(id='take-1',dealerId='dragan',status='approved') {
  const identity={dealerId,lineId:'goodluck',takeId:'goodluck_1',language:'en',exactText:'Original recorded words.',videoSha256:'a'.repeat(64),audioSha256:'b'.repeat(64),indexSha256:'c'.repeat(64),fps:25,frameCount:50,audioDelayMs:0,entryPose:'VILA',exitPose:'VILA',calibrationRevision:'test-1'};
  const proof=state=>({status:state,by:'Reviewer',at:'2026-10-15T10:00:00.000Z',identity:{...identity}});
  return {id,label:'Original take',dealer:dealerId,available:true,integrity:'verified',previewUrl:'/studio/api/videos/'+id,contentType:'video/mp4',sha256:identity.videoSha256,
    classification:{dealerId,kind:'speech',eventId:'speak.goodluck',situation:'goodluck',recordedSpeech:{schemaVersion:1,...identity,recording:proof('verified-recording'),review:status==='pending'?{status}:proof(status)}}};
}
test('recording inventory counts actual owner/game files, not 17 templates or a voice profile',()=>{
  const own=recordingFixture(),foreign=recordingFixture('foreign','paow'),archived=recordingFixture('archived'),roulette=recordingFixture('roulette');
  archived.classification.archived=true;roulette.classification.game='roulette';
  const conflict=recordingFixture('owner-conflict');conflict.dealer='paow';
  const inventory={videos:[own,foreign,archived,roulette,conflict]},project={clipLabels:{'take-1':'Readable take'}};
  const before=structuredClone(inventory),rows=studioRecordedSpeech(project,inventory,'dragan');
  assert.deepEqual(rows.map(row=>row.id),['take-1']);assert.equal(rows[0].label,'Readable take');assert.equal(rows[0].exactText,'Original recorded words.');assert.equal(rows[0].language,'en');assert.equal(rows[0].review,'approved');assert.equal(rows[0].available,true);
  assert.deepEqual(studioRecordedSpeech(project,inventory,'dragan','roulette').map(row=>row.id),['roulette']);assert.deepEqual(studioRecordedSpeech({}, {videos:[]},'dragan'),[]);assert.deepEqual(inventory,before);
});
test('recorded approvals are invalidated by changed bytes or proof while pending/rejected/missing stay explicit',()=>{
  const changed=recordingFixture('changed');changed.sha256='d'.repeat(64);
  const broken=recordingFixture('broken');broken.classification.recordedSpeech.review.identity.audioSha256='e'.repeat(64);
  const missing=recordingFixture('legacy');delete missing.classification.recordedSpeech;
  const unavailable=recordingFixture('unavailable');unavailable.available=false;
  const unsafe=recordingFixture('unsafe');unsafe.previewUrl='https://provider.invalid/private';
  const rows=studioRecordedSpeech({}, {videos:[changed,broken,missing,unavailable,unsafe,recordingFixture('pending','dragan','pending'),recordingFixture('rejected','dragan','rejected')]},'dragan');
  const byId=Object.fromEntries(rows.map(row=>[row.id,row]));
  assert.equal(byId.changed.review,'invalid-proof');assert.equal(byId.broken.review,'invalid-proof');assert.equal(byId.legacy.review,'missing-proof');assert.equal(byId.legacy.exactText,'');assert.equal(byId.pending.review,'pending');assert.equal(byId.rejected.review,'rejected');assert.equal(byId.unavailable.available,false);assert.equal(byId.unavailable.review,'unavailable');assert.equal(byId.unsafe.available,false);assert.equal(byId.unsafe.url,null);
});
test('panel separates recorded original text from generation language and opens with no provider call or dirty form',async()=>{
  const h=await panelHarness();h.props.projectDirty=false;h.props.dealerId='dragan';h.props.project={...h.props.project,dealers:[{id:'dragan',label:'Dragan'}]};h.props.inventory={videos:[recordingFixture()]};
  const original=structuredClone(h.props.project);h.render();h.flush();let tree=h.render();h.flush();
  const summaries=h.nodes(tree,node=>node.type==='summary').map(node=>node.props.children);assert.ok(summaries.includes('Ny generering · textmallar'));assert.ok(summaries.includes('Realtidstal · röst och referens'));assert.ok(!summaries.includes('Talbibliotek · inspelade repliker'));
  assert.equal(h.field(tree,'Inspelad fil').props.value,'take-1');
  assert.ok(h.nodes(tree,node=>node.type==='p'&&node.props.children==='Original recorded words.').length);
  h.field(tree,'Språk').props.onChange({target:{value:'sv'}});tree=h.render();h.flush();
  assert.ok(h.nodes(tree,node=>node.type==='p'&&node.props.children==='Original recorded words.').length);
  assert.equal(h.calls.length,0);assert.deepEqual(h.props.project,original);assert.equal(h.props.profileDirty,false);
});

test('audio-only and unavailable records remain files, never an inferred talvideo',()=>{
  const audio={id:'audio-only',label:'Audio only',dealer:'dragan',available:true,integrity:'verified',previewUrl:'/studio/api/videos/audio-only',contentType:'audio/mpeg',sha256:'f'.repeat(64),classification:{dealerId:'dragan',kind:'speech',eventId:'speak.goodluck',situation:'goodluck',mediaType:'audio'}};
  const row=studioRecordedSpeech({}, {videos:[audio]},'dragan')[0];assert.equal(row.audio,true);assert.equal(row.review,'missing-proof');assert.equal(row.exactText,'');assert.equal(row.available,true);
});
