from pathlib import Path
import shutil,os
here=Path(__file__).resolve().parent
gr=here.parent;mt=gr.parent;public=gr/'runtime/public';target=public/'astrid-continuous';target.mkdir(exist_ok=True)
shutil.copy2(here/'player.mjs',target/'player.mjs')
for name,src in {'actor.mp4':mt/'camera60-draft/cadence-full/camera-joined60-background-mixed-v5-720.mp4','joined-ledger.json':mt/'camera60-draft/cadence-full/joined-ledger.json','shoe.png':mt/'camera-card-fit/shoe-mask/card-allowed.png'}.items():
 assert src.is_file(),src
 out=target/name
 if not out.exists():out.symlink_to(src)
 else:assert out.resolve()==src.resolve()
gpu=(mt.parent/'compositor-viewer/packed-gpu.mjs').read_text()
gpu=gpu.replace('return {paint(record,options={})','return {dispose(){const resources=new Set();scene.traverse(n=>{if(n.geometry)resources.add(n.geometry);if(n.material){resources.add(n.material);if(n.material.map)resources.add(n.material.map);}});for(const t of textures.values())resources.add(t);if(shoeMask)resources.add(shoeMask);for(const r of resources)r.dispose();renderer.dispose();renderer.forceContextLoss();},paint(record,options={})')
(target/'packed-gpu.mjs').write_text(gpu)
app=public/'app.mjs';assert not app.is_symlink();s=app.read_text()
imp="import {playContinuousPass} from './astrid-continuous/player.mjs';\n"
if imp not in s:s=imp+s
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
  const continuousOpening=DEALER.key==='astrid'&&location.hostname==='astridsingleseat.localhost'&&location.port==='4190'&&new URLSearchParams(location.search).get('astridContinuous')!=='off'&&live.length===3;
  if(continuousOpening){
    for(let pass=0;pass<2;pass++){
      const deliveries=[];
      const add=(container,card,faceDown,shoeDraw,cards)=>{const el=cardEl(card,faceDown),n=container.querySelectorAll('.card').length;el.style.setProperty('--ci',n);container.style.setProperty('--cn',n+1);container.style.setProperty('--fan',Math.min(1,3.2/Math.max(2,n+1)).toFixed(3));el.style.visibility='hidden';container.append(el);deliveries.push({el,card:faceDown?null:card,faceDown,shoeDraw,container,cards});};
      for(let i=live.length-1;i>=0;i--)add(boxContainer(i),live[i].cards[pass],false,live[i].cards[pass].shoeDraw,live[i].cards.slice(0,pass+1));
      add($('#dealer-cards'),pass?null:round.dealer[0],pass===1,pass?round.holeDraw:round.dealer[0].shoeDraw,[round.dealer[0]]);
      const shown=new Set();const onLand=d=>{if(shown.has(d.shoeDraw))return;shown.add(d.shoeDraw);if(shoeState)showShoe({...shoeState,dealt:d.shoeDraw,remaining:shoeState.total-d.shoeDraw,cutReached:d.shoeDraw>=shoeState.cutAfter});updateBadge(d.container,d.cards);sfx.play('land');};
      try{await playContinuousPass({deliveries,onLand,suspend:()=>{performancePlayer?.cancel();performancePlayer?.release();return engine.suspendPresentation();}});}catch(error){console.warn('[continuous-demo]',error);for(const d of deliveries){d.el.style.visibility='';onLand(d);}}
    }
  }else{
'''+original.replace('  const live = round.live();\n','')+'  }\n'
 s=s[:start]+replacement+s[end:]
tmp=app.with_suffix('.continuous.tmp');tmp.write_text(s);os.replace(tmp,app)
print(target)
