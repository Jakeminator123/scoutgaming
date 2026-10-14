import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createEmptyProject,addDealer} from '../lib/studio-model.mjs';
import {dealerMediaSlots} from '../lib/dealer-media-library.mjs';
import {bindSpeechSlotStandard} from '../../web/public/speech-slot-bindings.mjs';
const file=new URL('./dealer-speech-slot-editor.tsx',import.meta.url),require=createRequire(file),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('next/dist/build/swc');
const output=transformSync(readFileSync(file,'utf8'),{filename:file.pathname,jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const module={exports:{}};
runInNewContext(output.code,{module,exports:module.exports,require:name=>{
  if(name==='react')return {...React,useId:()=> 'speech-slot-select'};
  if(name==='./dealer-video-surface')return {DealerClipPreview:({url})=>React.createElement('video',{src:url})};
  return require(name);
}});
const Editor=module.exports.DealerSpeechSlotEditor;
const project=addDealer(createEmptyProject(),'dragan','Dragan');
const slot=dealerMediaSlots(project,'speech').find(row=>row.situation==='greeting');
const pendingSpeech={schemaVersion:1,dealerId:'dragan',lineId:'greeting',takeId:'greeting_1',language:'sv',exactText:'Välkommen.',videoSha256:'a'.repeat(64),audioSha256:'b'.repeat(64),indexSha256:'c'.repeat(64),fps:25,frameCount:50,audioDelayMs:0,entryPose:'VILA',exitPose:'VILA',calibrationRevision:'test-1',recording:{status:'pending'},review:{status:'pending'}};
const own={id:'11111111-1111-4111-8111-111111111111',dealer:'dragan',available:true,label:'Välkommen',sha256:'a'.repeat(64),previewUrl:'/greeting.mp4',classification:{dealerId:'dragan',eventId:slot.eventId,situation:slot.situation,kind:'speech',recordedSpeech:pendingSpeech}};
const children=tree=>[tree,...React.Children.toArray(tree?.props?.children).flatMap(child=>typeof child==='object'?children(child):[])];
function render(patches={}){return Editor({project,inventory:{videos:[own]},dealerId:'dragan',slot,blocked:false,onChange(){},...patches});}
test('speech picker only offers available own video for the exact slot and does not select automatically',()=>{
 const wrong=[{...own,id:'no-tuple',classification:{...own.classification,recordedSpeech:undefined}},{...own,id:'blackjack',classification:{...own.classification,situation:'blackjack'}},{...own,id:'foreign',dealer:'paow'},
 {...own,id:'audio',classification:{...own.classification,mediaType:'audio'}},{...own,id:'archived',classification:{...own.classification,archived:true}},
 {...own,id:'deleting',deletion:{state:'pending'}},{...own,id:'missing',available:false}];
 const tree=render({inventory:{videos:[own,...wrong]}}),nodes=children(tree),select=nodes.find(row=>row.type==='select');
 assert.equal(select.props.value,'');
 assert.deepEqual(nodes.filter(row=>row.type==='option').map(row=>row.props.value),['',own.id]);
 const html=renderToStaticMarkup(tree);assert.match(html,/Standardklipp för/);assert.match(html,/for="speech-slot-select"/);assert.doesNotMatch(html,/<video/);
});
test('picker reports explicit choices, permits detach, and ignores invalid or blocked changes',()=>{
 const changes=[],tree=render({onChange:value=>changes.push(value)}),select=children(tree).find(row=>row.type==='select');
 for(const value of [own.id,'foreign',''])select.props.onChange({currentTarget:{value}});
 assert.deepEqual(changes,[own.id,null]);
 const locked=children(render({blocked:true,onChange:()=>assert.fail('blocked')}));
 assert.equal(locked[0].props.disabled,true);locked.find(row=>row.type==='select').props.onChange({currentTarget:{value:own.id}});
});
test('unavailable saved speech is visible and never silently replaced',()=>{
 const saved=bindSpeechSlotStandard(project,{dealerId:'dragan',eventId:slot.eventId,situation:slot.situation,videoId:own.id});
 const tree=render({project:saved,inventory:{videos:[]}}),nodes=children(tree);
 assert.equal(nodes.find(row=>row.type==='select').props.value,own.id);
 assert.equal(nodes.find(row=>row.type==='option'&&row.props.value===own.id).props.disabled,true);
 assert.match(renderToStaticMarkup(tree),/inte tillgängligt/);
});
test('picker shows exact text but a changed hash never inherits audiovisual approval',()=>{
 const identity={dealerId:'dragan',lineId:'greeting',takeId:'greeting_1',language:'sv',exactText:'Välkommen.',videoSha256:own.sha256,audioSha256:'b'.repeat(64),indexSha256:'c'.repeat(64),fps:25,frameCount:50,audioDelayMs:0,entryPose:'VILA',exitPose:'VILA',calibrationRevision:'test-1'};
 const proof=status=>({status,by:'fixture',at:'2026-10-14T12:00:00.000Z',identity});
 const recorded={schemaVersion:1,...identity,recording:proof('verified-recording'),review:proof('approved')};
 const video={...own,classification:{...own.classification,recordedSpeech:recorded}};
 const saved=bindSpeechSlotStandard(project,{dealerId:'dragan',eventId:slot.eventId,situation:slot.situation,videoId:own.id});
 assert.match(renderToStaticMarkup(render({project:saved,inventory:{videos:[video]}})),/Ljud och bild är granskade/);
 const changed=renderToStaticMarkup(render({project:saved,inventory:{videos:[{...video,sha256:'d'.repeat(64)}]}}));
 assert.doesNotMatch(changed,/Ljud och bild är granskade/);
});

test('an existing exact older baseline remains visible when no per-slot choice is saved',()=>{
 const saved=structuredClone(project),line=saved.lines.find(row=>row.dealerId==='dragan'&&row.eventId==='speak.other');
 line.variants.find(row=>row.id===line.baselineVariantId).videoGenerationId=own.id;
 const tree=render({project:saved}),html=renderToStaticMarkup(tree);
 assert.equal(children(tree).find(row=>row.type==='select').props.value,'');
 assert.match(html,/behåll äldre standard/);assert.match(html,/äldre standarden Välkommen/);assert.match(html,/<video/);
 assert.doesNotMatch(html,/Inget standardklipp/);
});
