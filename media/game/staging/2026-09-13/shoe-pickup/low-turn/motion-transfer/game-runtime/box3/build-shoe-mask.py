from pathlib import Path
from PIL import Image
import json,numpy as np,hashlib
here=Path(__file__).resolve().parent
mapping=json.loads((here.parents[1]/'next-source-investigation/existing-continuation-search/extended/contact-proof-map.json').read_text());reg={'matrix':mapping['contactToCameraLockedSimilarity']};m=np.eye(3);m[:2]=reg['matrix'];inv=np.linalg.inv(m)
source=here/'shoe-occlusion/allowed-card.png';out=here/'shoe-allowed-canonical.png'
with Image.open(source) as im:
 assert im.size==(1920,1080)
 im.convert('L').transform((1920,1080),Image.Transform.AFFINE,tuple(inv[:2].reshape(-1)),resample=Image.Resampling.BILINEAR,fillcolor=255).save(out)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
(here/'shoe-mask-receipt.json').write_text(json.dumps({'sourceSHA256':sha(source),'outputSHA256':sha(out),'matrix':reg['matrix'],'policy':'Same global camera similarity as actor andcard. Whiteallowsprop; blackoccludeswithactualhardware. NoRGBchanges. Native seam uncertainty±2px remains.','startSource':38,'endSource':48},indent=2)+'\n')
