"""Inactive dealer-up scaffold; isolated app atomic patch, no public writes."""
from pathlib import Path
import os
here=Path(__file__).resolve().parent;app=here.parent/'runtime/public/app.mjs';assert not app.is_symlink();s=app.read_text()
line="import {tryAstridDealerUp} from './astrid-single-seat/dealer-up-bridge.mjs';\n"
if line not in s:s=line+s
start=s.index('  const isolatedReview=tryAstridBox0(');end=s.index('  if(isolatedReview)return isolatedReview;',start)+len('  if(isolatedReview)return isolatedReview;')
original=s[start:end];addition=original.replace('isolatedReview','isolatedDealerUp').replace('tryAstridBox0','tryAstridDealerUp')
if 'const isolatedDealerUp=' not in s:s=s[:start]+addition+'\n'+s[start:]
tmp=app.with_suffix('.dealer-up.tmp');tmp.write_text(s);os.replace(tmp,app);print(app)
