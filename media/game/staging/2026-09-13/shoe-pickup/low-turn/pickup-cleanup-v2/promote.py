"""Apply reviewed staging-only mask patches after base pickup builder."""
from pathlib import Path
import json,hashlib,shutil
import numpy as np
from PIL import Image
p=Path(__file__).parent;target=p.parent/'pickup-draft';receipt=json.loads((p/'receipt.json').read_text());sha=lambda q:hashlib.sha256(q.read_bytes()).hexdigest()
for row in receipt['rows']:
 dst=target/'pickup-rg'/f"{row['frame']:04}.png";candidate=p/'rg'/dst.name
 assert sha(candidate)==row['outputSha256']
 assert sha(dst) in [row['inputSha256'],row['outputSha256']],f'Unexpected base mask {dst}'
 shutil.copyfile(candidate,dst)
 rgb=np.array(Image.open(p.parent/'mattes/source/frames'/f"{row['frame']+1:04}.png").convert('RGB'));alpha=np.array(Image.open(candidate))[:,:,:1]/255
 yy,xx=np.indices((1080,1920));checker=np.where(((xx//24+yy//24)%2)[...,None],[85,100,112],[150,162,174]);view=(rgb*alpha+checker*(1-alpha)).astype('uint8');Image.fromarray(view).save(target/'pickup-checker'/f"{row['frame']:04}.jpg",quality=94)
h={str(f.relative_to(target)):sha(f) for f in sorted((target/'pickup-rg').glob('*.png'))};h['build-pickup.py']=sha(target/'build-pickup.py');h['cleanupScript']=sha(p/'build.py');h['cleanupApplyScript']=sha(Path(__file__));(target/'SHA256.json').write_text(json.dumps(h,indent=2)+'\n')
(target/'paper-cleanup-receipt.json').write_text(json.dumps({'status':'reviewed-staging-paper-removal-not-contact-approval','sourceReceiptSha256':sha(p/'receipt.json'),'frames':[r['frame']for r in receipt['rows']]},indent=2)+'\n')
