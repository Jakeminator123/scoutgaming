import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createStudioPreview} from '../../../../lab/lib/studio-preview-client.mjs';
const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild');
const source=readFileSync(new URL('../components/studio/saved-scene-preview.tsx',import.meta.url),'utf8');
const compiled=transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
const id='11111111-1111-4111-8111-111111111111';
const receipt={sessionId:id,presentationLaneId:'evening',projectRevision:'saved:7',expiresAt:'2099-01-01T00:00:00.000Z',entryUrl:'/studio-preview/'+id};
const walk=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>walk(child,predicate))];
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
function harness(options={}){
  const slots=[],effects=[],docEvents=new Map(),winEvents=new Map(),calls=[];let cursor=0,tree,dirty=true,live=true;
  const props={active:true,presentationLaneId:'evening',revision:'saved:7',dealerId:'dragan',game:'blackjack',...options.props};
  const document={hidden:false,addEventListener:(event,fn)=>docEvents.set(event,fn),removeEventListener:event=>docEvents.delete(event)};
  const window={addEventListener:(event,fn)=>winEvents.set(event,fn),removeEventListener:event=>winEvents.delete(event)};
  const frameWindow={location:{pathname:receipt.entryUrl}};
  const frame={contentWindow:frameWindow,contentDocument:{documentElement:{dataset:{studioPreview:JSON.stringify(receipt)}}}};
  const fetchImpl=async(path,init)=>{calls.push({path,init});return init.method==='POST'
    ?options.create?options.create(path,init):Response.json(receipt,{status:201})
    :new Response('',{status:options.closeStatus??200});};
  const react={...React,useRef(initial){const i=cursor++;return slots[i]??=( {current:initial});},
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;
      return[slots[i],value=>{const next=typeof value==='function'?value(slots[i]):value;if(!Object.is(next,slots[i])){slots[i]=next;dirty=true;}}];},
    useEffect(effect,deps){const i=cursor++,old=slots[i];if(!old||deps.some((value,n)=>value!==old.deps[n]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:effect()};});}};
  const module={exports:{}};
  runInNewContext(compiled,{module,exports:module.exports,document,window,Error,location:{origin:'https://studio.test'},fetch:fetchImpl,
    require:name=>name==='react'?react:name.endsWith('studio-preview-client.mjs')?{createStudioPreview:args=>createStudioPreview(args,{fetchImpl})}:require(name)});
  function render(){if(!live)return;let count=0;do{dirty=false;cursor=0;tree=module.exports.SavedScenePreview(props);
    for(const node of walk(tree,node=>node.type==='iframe'))node.props.ref.current=frame;
    for(const effect of effects.splice(0))effect();if(++count>20)throw Error('Render loop');}while(dirty);return tree;}
  render();
  return{calls,props,frame,render,async flush(){for(let i=0;i<4;i++){await new Promise(resolve=>setImmediate(resolve));render();}},
    set(changes){Object.assign(props,changes);render();},
    start(){const button=walk(render(),node=>node.type==='button')[0];if(!button.props.disabled)button.props.onClick();render();},
    stop(){walk(render(),node=>node.type==='button'&&node.props.children==='Stoppa provspelning')[0]?.props.onClick();render();},
    iframe(){return walk(render(),node=>node.type==='iframe')[0];},
    alerts(){return walk(render(),node=>node.props?.role==='alert').map(node=>node.props.children);},
    hide(){document.hidden=true;docEvents.get('visibilitychange')?.();render();},
    message(data,overrides={}){winEvents.get('message')?.({origin:'https://studio.test',source:frameWindow,data,...overrides});render();},
    unmount(){for(const slot of slots)slot?.cleanup?.();live=false;},
  };
}
test('saved scene is explicit, blackjack-only, and sends the saved project revision without gameplay commands',async()=>{
  for(const props of [{game:'roulette'},{presentationLaneId:undefined},{revision:undefined},{blocked:true},{active:false}]){
    const h=harness({props});h.start();await h.flush();assert.equal(h.calls.length,0);assert.equal(h.iframe(),undefined);h.unmount();
  }
  let started=0;const h=harness({props:{onStart:()=>started++}});h.start();await h.flush();
  assert.equal(started,1);assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,'/api/studio-preview');
  assert.deepEqual(JSON.parse(h.calls[0].init.body),{presentationLaneId:'evening',expectedProjectRevision:'saved:7'});
  assert.equal(h.iframe().props.src,receipt.entryUrl);h.iframe().props.onLoad();assert.deepEqual(h.alerts(),[]);
  h.stop();await h.flush();assert.equal(h.iframe(),undefined);assert.equal(h.calls.at(-1).path,'/api/studio-preview/'+id);assert.equal(h.calls.at(-1).init.method,'DELETE');
  h.unmount();
});
test('hidden workspaces, hidden documents, changed context and unmount close the session',async()=>{
  for(const action of [h=>h.set({active:false}),h=>h.hide(),h=>h.set({revision:'saved:8'}),h=>h.set({dealerId:'other'}),h=>h.set({blocked:true}),h=>h.unmount()]){
    const h=harness();h.start();await h.flush();action(h);await h.flush();
    assert.equal(h.calls.filter(row=>row.init.method==='DELETE').length,1);h.unmount();
  }
});
test('a late create response is closed after hiding or changing revision, never embedded',async()=>{
  for(const action of [h=>h.set({active:false}),h=>h.set({revision:'saved:8'}),h=>h.unmount()]){
    const deferredResponse=deferred(),h=harness({create:()=>deferredResponse.promise});h.start();action(h);
    deferredResponse.resolve(Response.json(receipt,{status:201}));await h.flush();
    assert.equal(h.calls.filter(row=>row.init.method==='DELETE').length,1);h.unmount();
  }
});
test('only the current same-origin frame can close its own preview',async()=>{
  const h=harness();h.start();await h.flush();const data={type:'croupier:studio-preview-close',sessionId:id};
  for(const [message,overrides]of [[data,{origin:'https://other.test'}],[data,{source:{}}],[{...data,sessionId:'other'},{}],[{type:'navigate',url:'/admin'},{}]]){
    h.message(message,overrides);assert.ok(h.iframe());
  }
  h.message(data);await h.flush();assert.equal(h.iframe(),undefined);assert.equal(h.calls.at(-1).init.method,'DELETE');h.unmount();
});
test('failed startup, wrong frame documents and failed closure are visible',async()=>{
  const denied=harness({create:async()=>Response.json({error:'studio_preview_revision_conflict'},{status:409})});denied.start();await denied.flush();
  assert.equal(denied.iframe(),undefined);assert.match(denied.alerts()[0],/Projektet har ändrats/);denied.unmount();
  const wrong=harness();wrong.start();await wrong.flush();wrong.frame.contentWindow.location.pathname='/admin';wrong.iframe().props.onLoad();await wrong.flush();
  assert.equal(wrong.iframe(),undefined);assert.match(wrong.alerts()[0],/kunde inte laddas/);wrong.unmount();
  const closing=harness({closeStatus:503});closing.start();await closing.flush();closing.stop();await closing.flush();
  assert.equal(closing.iframe(),undefined);assert.match(closing.alerts()[0],/servern kunde inte bekräfta/);closing.unmount();
});
