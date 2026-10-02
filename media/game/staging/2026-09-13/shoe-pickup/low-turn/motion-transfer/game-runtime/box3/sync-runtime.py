"""Stage completed artifacts only; does not enable query, modify app or layout."""
from pathlib import Path
import os,json,hashlib
here=Path(__file__).resolve().parent;dst=here.parent/'runtime/public/astrid-box3';dst.mkdir(parents=True,exist_ok=True)
required=['ledger.json','target.json','media-receipt.json','actor-gray.mp4','shoe-allowed-canonical.png']
for name in required:assert (here/name).is_file(),f'Missing reviewed candidate input: {name}'
receipt=json.loads((here/'media-receipt.json').read_text());ledger=json.loads((here/'ledger.json').read_text())
assert receipt['outputSHA256']==ledger['sourceSha256']
assert receipt['sourceSha256']==ledger['sourceVideoSha256']
assert hashlib.sha256((here/'shoe-allowed-canonical.png').read_bytes()).hexdigest()==receipt['shoeMaskSHA256']==ledger['shoeOcclusion']['sha256']
for name in required:
 out=dst/name;tmp=dst/(name+'.sync-tmp')
 if tmp.is_symlink() or tmp.exists():tmp.unlink()
 tmp.symlink_to(here/name);os.replace(tmp,out)
print(dst)
