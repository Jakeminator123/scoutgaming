"""Patch only the existing isolated4190 app; public4173 source is never written."""
from pathlib import Path
import hashlib,json,os
here=Path(__file__).resolve().parent;app=here.parent/'runtime/public/app.mjs';assert not app.is_symlink();source=app.read_text();original=hashlib.sha256(source.encode()).hexdigest()
line="import {tryAstridBox0} from './astrid-single-seat/game-bridge.mjs';\n"
if line not in source:source=line+source
anchor='function flyFromShoe(el, card, faceDown, cardMotion) {'
addition="\n  const isolatedReview=tryAstridBox0({el,card,faceDown,tableVersion,dealer:DEALER.key,suspend:()=>{if(speaking)throw Error('Speech is still playing');performancePlayer?.cancel();performancePlayer?.release();const snapshot=()=>({at:performance.now(),submitted:engine.stats.submitted??0,presented:engine.stats.presented??0,decoded:engine.stats.decoded??0,lease:{...engine.suspensionStats}});const before=snapshot(),release=engine.suspendPresentation();const receipt={before,acquired:snapshot()};let released=false;const resume=()=>{if(released)return;released=true;receipt.beforeRelease=snapshot();release();receipt.released=snapshot();};resume.receipt=receipt;return resume;}});\n  if(isolatedReview)return isolatedReview;"
legacy="\n  const isolatedReview=tryAstridBox0({el,card,faceDown,tableVersion,dealer:DEALER.key,suspend:()=>{performancePlayer?.cancel();performancePlayer?.release();}});\n  if(isolatedReview)return isolatedReview;"
previous=addition.replace("const snapshot=()=>({at:performance.now(),submitted:engine.stats.submitted??0,presented:engine.stats.presented??0,decoded:engine.stats.decoded??0,lease:{...engine.suspensionStats}});const before=snapshot(),release=engine.suspendPresentation();const receipt={before,acquired:snapshot()};let released=false;const resume=()=>{if(released)return;released=true;receipt.beforeRelease=snapshot();release();receipt.released=snapshot();};resume.receipt=receipt;return resume;","return engine.suspendPresentation();")
if previous in source:source=source.replace(previous,addition)
if legacy in source:source=source.replace(legacy,addition)
if addition not in source:
 assert source.count(anchor)==1;source=source.replace(anchor,anchor+addition)
tmp=app.with_suffix('.review.tmp');tmp.write_text(source);os.replace(tmp,app);(here/'game-review-patch-receipt.json').write_text(json.dumps({'scope':'isolated runtime app only','app':str(app),'beforeSHA256':original,'afterSHA256':hashlib.sha256(source.encode()).hexdigest(),'optin':'astridBox0=review; exactastridsingleseat.localhost:4190;Astridbox0/box1firstcard;astridBox1=review'},indent=2))
print(app)
