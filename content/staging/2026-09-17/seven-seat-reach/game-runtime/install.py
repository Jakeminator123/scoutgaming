from pathlib import Path
import os
here=Path(__file__).resolve().parent
clips=here.parent
runtime=Path.home()/'Desktop/croupier/content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/game-runtime/runtime'
public=runtime/'public';target=public/'astrid-seven';target.mkdir(exist_ok=True)
(target/'bridge.mjs').write_text((here/'bridge.mjs').read_text())
for box,name in {0:'box0-reach-v2.mp4',1:'box1-reach-v2.mp4',2:'box2-reach.mp4',3:'box3-reach.mp4',4:'box4-reach.mp4'}.items():
 src=clips/name;assert src.is_file(),src;out=target/f'box{box}.mp4'
 if out.is_symlink() or out.exists():out.unlink()
 out.symlink_to(src)
app=public/'app.mjs';s=app.read_text()
imp="import {tryAstridSeven} from './astrid-seven/bridge.mjs';\n"
if imp not in s:s=imp+s
hook="  const isolatedSeven=tryAstridSeven({el,card,faceDown,tableVersion,dealer:DEALER.key,suspend:()=>{performancePlayer?.cancel();performancePlayer?.release();return engine.suspendPresentation();}});\n  if(isolatedSeven)return isolatedSeven;\n"
anchor='function flyFromShoe(el, card, faceDown, cardMotion) {\n'
assert anchor in s
if hook not in s:s=s.replace(anchor,anchor+hook,1)
tmp=app.with_suffix('.seven.tmp');tmp.write_text(s);os.replace(tmp,app)
print('installed',target)
