import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {setImmediate} from 'node:timers/promises';
import {createSeedProject,validateProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import {layerAssetReferences} from '../../../lib/layer-asset-removal.mjs';
import {materialLabel} from '../../../../../packages/presentation/contracts/material-catalog.mjs';
import {layerAssetFitsGame,layerAssetPath} from '../../../../../packages/presentation/contracts/layer-asset-contract.mjs';
const require=createRequire(import.meta.url),React=require('react');
const nodes=(node,predicate)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(child=>nodes(child,predicate)):[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];
const text=node=>typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
async function harness(search='?tab=bordsgrafik&game=roulette',role='table') {
  const project=createSeedProject();
  project.layerAssets=[['roulette','Roulette board','table'],['blackjack','Blackjack board','table'],[undefined,'Legacy board','table'],[undefined,'Shared background','background']].map(([game,label,role],index)=>{
    const asset={schemaVersion:1,id:`10000000-0000-4000-8000-00000000000${index}`,role,label,sha256:'a'.repeat(64),size:128,contentType:'image/png',width:1920,height:1080,...(game?{game}:{})};
    return {...asset,pathname:layerAssetPath(asset)};
  });
  const newStore=()=>({states:[],effects:[],queue:[],cursor:0});
  const parent=newStore(),cards=new Map(),navigated=[];let current=parent,changed=0;
  const hooks={...React,useState(initial){const store=current,index=store.cursor++;if(!(index in store.states))store.states[index]=typeof initial==='function'?initial():initial;return [store.states[index],value=>store.states[index]=typeof value==='function'?value(store.states[index]):value];},
    useRef(value){const index=current.cursor++;return current.states[index]??={current:value};},
    useEffect(callback,deps){const store=current,index=store.cursor++;if(!store.effects[index]||deps.some((value,i)=>value!==store.effects[index].deps[i])){store.queue.push(()=>{store.effects[index]?.cleanup?.();store.effects[index]={deps,cleanup:callback()};});}}};
  const visibility=new Set(),doc={hidden:false,addEventListener:(name,fn)=>visibility.add(fn),removeEventListener:(name,fn)=>visibility.delete(fn)};
  const LayerLibrary=()=>null,LayerAssetManager=()=>null,AiBackgroundDialog=()=>null,module={exports:{}};
  // The kit's menu and dialogs stay unexpanded elements; tests read their props (actions, open, children).
  const ActionMenu=()=>null,Dialog=()=>null,ConfirmDialog=()=>null,Button=props=>React.createElement('button',props);
  const source=readFileSync(new URL('../components/studio/registered-material-library.tsx',import.meta.url),'utf8');
  runInNewContext(require('esbuild').transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,URLSearchParams,AbortController,document:doc,location:{search},window:{addEventListener(){},removeEventListener(){}},require:name=>{
    if(name==='react')return hooks;
    if(name.endsWith('/runtime/navigation'))return {useSearchParams:()=>new URLSearchParams(search),navigate:href=>{navigated.push(href);search=new URL(href,'https://fixture.invalid').search;}};
    if(name.includes('studio-model.mjs'))return {validateProject};
    if(name.includes('layer-asset-removal.mjs'))return {layerAssetReferences};
    if(name.includes('material-catalog.mjs'))return {materialLabel};
    if(name.includes('layer-asset-contract.mjs'))return {layerAssetFitsGame};
    if(name.endsWith('/layer-library'))return {LayerLibrary};
    if(name.endsWith('/layer-asset-manager'))return {LayerAssetManager};
    if(name==='./ai-background-dialog')return {AiBackgroundDialog};
    if(name==='../ui/hub')return {ActionMenu};
    if(name==='../ui/dialog')return {Dialog,ConfirmDialog};
    if(name==='../ui/kit')return {Button,buttonVariants:()=>'button',cn:(...names)=>names.filter(Boolean).join(' '),plural:(count,one,many)=>`${count} ${count===1?one:many}`};
    if(name==='lucide-react')return new Proxy({},{get:()=>()=>null});
    if(name.includes('connected-studio.mjs'))return {createStudioClient:()=>({load:async()=>({project})})};
    return require(name);
  }});
  const props={role,base:'/admin/scenes',visible:true,disabled:false,refreshKey:'1',onChanged:()=>changed++};
  const renderWith=(store,Component,props)=>{current=store;store.cursor=0;const tree=Component(props);while(store.queue.length)store.queue.shift()();return tree;};
  const render=()=>renderWith(parent,module.exports.RegisteredMaterialLibrary,props);
  const manager=tree=>nodes(tree,node=>node.type===LayerAssetManager)[0];
  const visible=tree=>{const {role,filterAsset}=manager(tree).props;return project.layerAssets.filter(asset=>asset.role===role&&filterAsset(asset));};
  const card=(asset,actions={disabled:false,onTrash(){}})=>{
    const element=manager(render()).props.renderAsset(asset,actions);
    if(!cards.has(asset.id))cards.set(asset.id,newStore());
    return renderWith(cards.get(asset.id),element.type,element.props);
  };
  render();await setImmediate();
  return {project,props,render,visible,card,LayerLibrary,LayerAssetManager,AiBackgroundDialog,ActionMenu,Dialog,navigated,hide:value=>{doc.hidden=value;visibility.forEach(fn=>fn());},query:()=>search,navigate:value=>{search=value;},changed:()=>changed,close:()=>[parent,...cards.values()].forEach(store=>store.effects.forEach(effect=>effect?.cleanup?.()))};
}

test('real assets page scopes table upload and visible library to explicit game, with shared backgrounds',async()=>{
  const h=await harness();try {
    let tree=h.render(),uploader=nodes(tree,node=>node.type===h.LayerLibrary)[0];
    assert.equal(uploader.props.game,'roulette');assert.equal(uploader.props.disabled,false);
    assert.deepEqual(h.visible(tree).map(asset=>asset.label),['Roulette board']);
    assert.equal(nodes(tree,node=>node.type==='li').length,0,'no duplicate gallery beside the lifecycle cards');
    assert.equal(nodes(tree,node=>node.type===h.LayerAssetManager)[0].props.project,h.project,'lifecycle manager retains complete dependency graph');
    assert.equal(nodes(tree,node=>node.props?.role==='tablist'||node.type==='h1').length,0,'the Scenes page owns the heading and the role tabs');
    assert.equal(nodes(tree,node=>node.type===h.LayerAssetManager)[0].props.view,'library','the trash lives only on the Papperskorg tab');
    const pill=(tree,label)=>nodes(tree,node=>node.type==='button'&&node.props['aria-pressed']!==undefined&&text(node)===label)[0];
    assert.equal(pill(tree,'Roulette').props['aria-pressed'],true);
    pill(tree,'Blackjack').props.onClick();tree=h.render();
    assert.deepEqual(h.navigated,['/admin/scenes?tab=material&filter=bordsgrafik&game=blackjack'],'the game filter stays on the table graphics tab of Scenes');
    assert.equal(nodes(tree,node=>node.type===h.LayerLibrary)[0].props.game,'blackjack');
    assert.deepEqual(h.visible(tree).map(asset=>asset.label),['Blackjack board','Legacy board']);
    h.props.role='background';tree=h.render();
    assert.equal(nodes(tree,node=>node.type==='button'&&node.props['aria-pressed']!==undefined).length,0,'backgrounds are shared by every game');
    assert.equal(nodes(tree,node=>node.type===h.LayerLibrary)[0].props.role,'background');
    assert.deepEqual(h.visible(tree).map(asset=>asset.label),['Shared background']);
  } finally{h.close();}
});

test('upload readback cannot accept a table registered for another game; unspecified game preserves blackjack',async()=>{
  const h=await harness();try {
    nodes(h.render(),node=>node.type===h.LayerLibrary)[0].props.onRegistered(h.project,h.project.layerAssets[1].id);
    assert.match(text(h.render()),/Registreringen kunde inte bekräftas för valt spel/);assert.equal(h.changed(),0);
  } finally{h.close();}
  const legacy=await harness('?tab=bordsgrafik');try {
    const uploader=nodes(legacy.render(),node=>node.type===legacy.LayerLibrary)[0];assert.equal(uploader.props.game,'blackjack');
    uploader.props.onRegistered(legacy.project,legacy.project.layerAssets[1].id);assert.equal(legacy.changed(),1);
  } finally{legacy.close();}
});


test('Skapa med AI sits beside the upload with the project dealers and scene templates and passes the same readback check',async()=>{
  const h=await harness();try {
    const aside=()=>nodes(h.render(),node=>node.type===h.LayerLibrary)[0].props.aside,ai=()=>nodes(aside(),node=>node.type===h.AiBackgroundDialog)[0];
    assert.deepEqual([ai().props.role,ai().props.game,ai().props.disabled],['table','roulette',false]);
    assert.equal(ai().props.dealers,h.project.dealers);assert.equal(ai().props.templates,h.project.lanes);
    assert.doesNotMatch(text(aside()),/Kommer snart/);
    ai().props.onRegistered(h.project,h.project.layerAssets[1].id);
    assert.match(text(h.render()),/Registreringen kunde inte bekräftas för valt spel/,'a Blackjack table is refused on the Roulette tab');assert.equal(h.changed(),0);
    ai().props.onRegistered(h.project,h.project.layerAssets[3].id);assert.equal(h.changed(),0,'a background is refused as table graphics');
    ai().props.onRegistered(h.project,'10000000-0000-4000-8000-0000000000ff');assert.equal(h.changed(),0,'an id missing from the returned project is refused');
    ai().props.onRegistered(h.project,h.project.layerAssets[0].id);assert.equal(h.changed(),1,'the Roulette table is accepted');
    ai().props.onBusyChange(true);
    assert.equal(nodes(h.render(),node=>node.type===h.LayerLibrary)[0].props.disabled,true,'a running AI request blocks upload and trash');
    ai().props.onBusyChange(false);
  } finally{h.close();}
});

test('material card shows loading, failed media and a retry while keeping the exact file identity',async()=>{
  const h=await harness();try{
    const asset=h.project.layerAssets[0],original=structuredClone(asset);
    let tree=h.card(asset),img=nodes(tree,node=>node.type==='img')[0];
    assert.equal(img.props.src,'/studio/api/layer-assets/'+asset.id);
    assert.match(text(tree),/Läser förhandsvisning/);
    img.props.onError();tree=h.card(asset);
    assert.match(text(tree),/Förhandsvisningen kunde inte läsas/);
    nodes(tree,node=>node.type==='button'&&text(node)==='Försök igen')[0].props.onClick();
    tree=h.card(asset);img=nodes(tree,node=>node.type==='img')[0];
    assert.equal(img.key,'1');assert.equal(img.props.src,'/studio/api/layer-assets/'+asset.id);
    img.props.onLoad();tree=h.card(asset);
    assert.doesNotMatch(text(tree),/Läser förhandsvisning|Förhandsvisningen kunde inte läsas/);
    const details=nodes(tree,node=>node.type===h.Dialog&&node.props.title==='Tekniska detaljer')[0];
    assert.equal(details.props.open,false,'technical details stay folded behind the ⋯ menu');
    assert.match(text(details),/PNG/);assert.match(text(details),new RegExp(asset.sha256));
    nodes(tree,node=>node.type===h.ActionMenu)[0].props.actions.find(action=>action.id==='details').onSelect();
    assert.equal(nodes(h.card(asset),node=>node.type===h.Dialog&&node.props.title==='Tekniska detaljer')[0].props.open,true);
    assert.deepEqual(asset,original,'presentation never rewrites media identity');
  }finally{h.close();}
});

test('video card waits for an explicit play with sound and lets the user recover from rejected playback',async()=>{
  const h=await harness();try{
    const asset={...h.project.layerAssets[3],contentType:'video/mp4',label:'Lounge_video'};
    let tree=h.card(asset),video=nodes(tree,node=>node.type==='video')[0],plays=0;
    const element={muted:true,play:async()=>{plays++;throw Error('blocked');}};
    video.props.ref.current=element;
    assert.equal(video.props.autoPlay,undefined);assert.equal(video.props.preload,'metadata');
    assert.equal(video.props.controls,false);assert.equal(plays,0);
    assert.equal(video.props.src,'/studio/api/layer-assets/'+asset.id+'#t=0.1');
    video.props.onLoadedData();tree=h.card(asset);
    const play=()=>nodes(tree,node=>node.type==='button'&&node.props['aria-label']==='Spela Lounge video med ljud')[0];
    assert.ok(play());play().props.onClick();await setImmediate();tree=h.card(asset);
    assert.equal(plays,1);assert.equal(element.muted,false);assert.match(text(tree),/Uppspelningen kunde inte starta/);
    element.play=async()=>{plays++;};play().props.onClick();await setImmediate();tree=h.card(asset);
    assert.equal(plays,2);assert.equal(nodes(tree,node=>node.type==='video')[0].props.controls,true);
    assert.doesNotMatch(text(tree),/Uppspelningen kunde inte starta/);
    nodes(tree,node=>node.type==='video')[0].props.onEnded();tree=h.card(asset);assert.ok(play());
  }finally{h.close();}
});

test('material card delegates trash to the guarded lifecycle action and respects its disabled state',async()=>{
  const h=await harness();try{
    let requested=0;const asset=h.project.layerAssets[0],actions={disabled:true,onTrash:()=>requested++};
    const trash=tree=>nodes(tree,node=>node.type===h.ActionMenu)[0].props.actions.find(action=>action.id==='trash');
    let tree=h.card(asset,actions);
    assert.ok(trash(tree).disabled,'a running change disables the trash entry and says why');assert.equal(requested,0);
    actions.disabled=false;tree=h.card(asset,actions);assert.equal(trash(tree).disabled,undefined);
    trash(tree).onSelect();assert.equal(requested,1);
  }finally{h.close();}
});
test('the trash tab shows only the archived files of the role, without upload',async()=>{
  const h=await harness('?tab=papperskorg');try{
    h.props.trashOnly=true;const tree=h.render();
    assert.equal(nodes(tree,node=>node.type===h.LayerLibrary).length,0);
    assert.equal(nodes(tree,node=>node.type===h.LayerAssetManager)[0].props.view,'trash');
  }finally{h.close();}
});

test('mounted material library follows alias context and keeps dealer and room while changing filters',async()=>{
  const h=await harness('?tab=bordsgrafik&game=blackjack&dealer=dragan&room=one');try{
    nodes(h.render(),node=>node.type==='button'&&node.props['aria-pressed']!==undefined&&text(node)==='Roulette')[0].props.onClick();
    const query=new URLSearchParams(h.query());
    assert.equal(query.get('dealer'),'dragan');assert.equal(query.get('room'),'one');
    assert.equal(query.get('tab'),'material');assert.equal(query.get('filter'),'bordsgrafik');assert.equal(query.get('game'),'roulette');
    assert.match(h.navigated.at(-1),/^\/admin\/scenes\?/);
    assert.deepEqual(h.visible(h.render()).map(asset=>asset.label),['Roulette board']);
    h.navigate('?tab=bakgrunder&game=roulette&dealer=astrid');h.props.role='background';
    assert.equal(nodes(h.render(),node=>node.type===h.LayerLibrary)[0].props.role,'background');
    assert.deepEqual(h.visible(h.render()).map(asset=>asset.label),['Shared background']);
    h.navigate('?tab=bordsgrafik&game=roulette&dealer=astrid');h.props.role='table';
    assert.deepEqual(h.visible(h.render()).map(asset=>asset.label),['Roulette board']);
  }finally{h.close();}
});

test('material previews are exclusive and pause on hidden workspace or document without restarting',async()=>{
  const h=await harness();let first=0,second=0;const a={pause:()=>first++},b={pause:()=>second++};
  try{
    h.render().props.onPlayCapture({target:a});h.render().props.onPlayCapture({target:b});
    assert.equal(first,1);assert.equal(second,0);
    h.props.visible=false;h.render();assert.ok(second>0);
    const count=second;h.props.visible=true;h.render();assert.ok(second>=count);
    h.render().props.onPlayCapture({target:a});h.hide(true);assert.ok(first>1);
    h.hide(false);assert.equal(a.play,undefined,'returning never requests playback');
  }finally{h.close();}
});
