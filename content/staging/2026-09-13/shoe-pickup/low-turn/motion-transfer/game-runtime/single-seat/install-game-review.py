"""Patch only the existing isolated4190 app; public4173 source is never written."""
from pathlib import Path
import hashlib,json
here=Path(__file__).resolve().parent;app=here.parent/'runtime/public/app.mjs';assert not app.is_symlink();source=app.read_text();original=hashlib.sha256(source.encode()).hexdigest()
line="import {tryAstridBox0} from './astrid-single-seat/game-bridge.mjs';\n"
if line not in source:source=line+source
anchor='function flyFromShoe(el, card, faceDown, cardMotion) {'
addition="\n  const isolatedReview=tryAstridBox0({el,card,faceDown,tableVersion,dealer:DEALER.key,suspend:()=>{performancePlayer?.cancel();performancePlayer?.release();}});\n  if(isolatedReview)return isolatedReview;"
if addition not in source:
 assert source.count(anchor)==1;source=source.replace(anchor,anchor+addition)
app.write_text(source);(here/'game-review-patch-receipt.json').write_text(json.dumps({'scope':'isolated runtime app only','app':str(app),'beforeSHA256':original,'afterSHA256':hashlib.sha256(source.encode()).hexdigest(),'optin':'astridBox0=review; exactastridsingleseat.localhost:4190;Astridbox0firstcard'},indent=2))
print(app)
