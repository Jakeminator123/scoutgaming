from pathlib import Path
import shutil,os
here=Path(__file__).resolve().parent
gr=here.parent;mt=gr.parent;public=gr/'runtime/public';target=public/'astrid-continuous';target.mkdir(exist_ok=True)
for module in here.glob('*.mjs'):
 if not module.name.endswith('.test.mjs'):shutil.copy2(module,target/module.name)
for name,src in {'actor.mp4':mt/'camera60-draft/cadence-full/camera-joined60-background-mixed-v5-720.mp4','joined-ledger.json':mt/'camera60-draft/cadence-full/joined-ledger.json','shoe.png':mt/'camera-card-fit/shoe-mask/card-allowed.png','return-bridge.mp4':mt/'idle-registration/bridge-pair/mattes/edge-clean/bridge-native-R-edge-clean-draft.mp4','return-bridge-registration.json':mt/'idle-registration/bridge-pair/review/endpoint-registration.json'}.items():
 assert src.is_file(),src
 out=target/name
 if not out.exists():out.symlink_to(src)
 else:assert out.resolve()==src.resolve()
gpu=(mt.parent/'compositor-viewer/packed-gpu.mjs').read_text()
gpu=gpu.replace(' const width=1920,height=1080;',' let disposed=false; const width=1920,height=1080;').replace('()=>renderer.render(scene,camera)','()=>{if(!disposed)renderer.render(scene,camera);}')
gpu=gpu.replace(' const textures=new Map(),planes=[];'," const pending=[];function loadTexture(url){let resolve,reject;const ready=new Promise((a,b)=>{resolve=a;reject=b;});pending.push(ready);return new THREE.TextureLoader().load(url,()=>{if(!disposed)renderer.render(scene,camera);resolve();},undefined,()=>reject(Error('Required card texture unavailable')));} const textures=new Map(),planes=[];")
gpu=gpu.replace("new THREE.TextureLoader().load('/assets/cardback.png',()=>{if(!disposed)renderer.render(scene,camera);})","loadTexture('/assets/cardback.png')").replace("new THREE.TextureLoader().load(settings.shoeMaskURL,()=>{if(!disposed)renderer.render(scene,camera);})","loadTexture(settings.shoeMaskURL)")
gpu=gpu.replace('return {paint(record,options={})','return {ready:Promise.all(pending),dispose(){if(disposed)return;disposed=true;const resources=new Set();scene.traverse(n=>{if(n.geometry)resources.add(n.geometry);if(n.material){resources.add(n.material);if(n.material.map)resources.add(n.material.map);}});for(const t of textures.values())resources.add(t);for(const t of faceTextures.values())resources.add(t);resources.add(backTex);if(shoeMask)resources.add(shoeMask);for(const r of resources)r.dispose();renderer.dispose();renderer.forceContextLoss();},paint(record,options={})')
(target/'packed-gpu.mjs').write_text(gpu)
app=public/'app.mjs';assert not app.is_symlink();s=app.read_text()
s=s.replace("import {playContinuousPass} from './astrid-continuous/player.mjs';\n",'')
imp="import {createContinuousSession} from './astrid-continuous/player.mjs';\n"
if imp not in s:s=imp+s
queue_import="import {openingQueue,openingChunks} from './astrid-continuous/opening-queue.mjs';\n"
if queue_import not in s:s=queue_import+s
function_start=s.index('async function dealSequence()')
end=s.index('  // side bets resolve',function_start)
section=s[function_start:end]
if 'const continuousOpening=' in section:
 start=s.index('  const live = round.live();',function_start)
 original_start=s.rindex('  await beginDealingTake();',function_start,end)
 original_end=s.rindex('  await endDealingTake();',function_start,end)+len('  await endDealingTake();\n')
 original=s[original_start:original_end]
else:
 start=s.index('  await beginDealingTake();',function_start)
 original=s[start:end]
if True:
 replacement='''  const live = round.live();
  const continuousOpening=DEALER.key==='astrid'&&location.hostname==='astridsingleseat.localhost'&&location.port==='4190'&&new URLSearchParams(location.search).get('astridContinuous')!=='off'&&live.length>=1&&live.length<=7;
  if(continuousOpening){
    const queue=openingQueue({hands:live,dealer:round.dealer,holeDraw:round.holeDraw});
    const continuousSession=createContinuousSession({suspend:()=>{performancePlayer?.cancel();performancePlayer?.release();return engine.suspendPresentation();},prepareIdle:async()=>{await performancePlayer?.prepareIdle();}});
    const chunks=openingChunks(queue);
    try{for(const [chunkIndex,chunk] of chunks.entries()){
      if(chunk.length<4){
        continuousSession.dispose();
        await beginDealingTake();
        for(const item of chunk){const container=item.kind==='dealer'?$('#dealer-cards'):boxContainer(item.handIndex);await deliverCard(container,item.card,{faceDown:item.faceDown,shoeDraw:item.shoeDraw,continues:true});updateBadge(container,item.cards);}
        await endDealingTake();continue;
      }
      const deliveries=chunk.map(item=>{const container=item.kind==='dealer'?$('#dealer-cards'):boxContainer(item.handIndex),el=cardEl(item.card,item.faceDown),n=container.querySelectorAll('.card').length;el.style.setProperty('--ci',n);container.style.setProperty('--cn',n+1);container.style.setProperty('--fan',Math.min(1,3.2/Math.max(2,n+1)).toFixed(3));el.style.visibility='hidden';container.append(el);return {...item,el,container};});
      const shown=new Set();const onLand=d=>{if(shown.has(d.shoeDraw))return;shown.add(d.shoeDraw);if(shoeState)showShoe({...shoeState,dealt:d.shoeDraw,remaining:shoeState.total-d.shoeDraw,cutReached:d.shoeDraw>=shoeState.cutAfter});updateBadge(d.container,d.cards);sfx.play('land');};
      try{await continuousSession.play({deliveries,onLand,finalReturn:chunkIndex===chunks.length-1});}catch(error){console.warn('[continuous-demo]',error);for(const d of deliveries){d.el.style.visibility='';onLand(d);}}
    }if(queue.length%4===0){try{await continuousSession.finish();}catch(error){console.warn('[continuous-return]',error);}}}finally{continuousSession.dispose();}
  }else{
'''+original.replace('  const live = round.live();\n','')+'  }\n'
 s=s[:start]+replacement+s[end:]
tmp=app.with_suffix('.continuous.tmp');tmp.write_text(s);os.replace(tmp,app)
print(target)
