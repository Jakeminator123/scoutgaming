"""Publish only the boxed candidate files to the existing isolated4190 runtime."""
from pathlib import Path
import shutil,json,hashlib
here=Path(__file__).resolve().parent
runtime=here.parent/'runtime/public/astrid-box1';runtime.mkdir(parents=True,exist_ok=True)
receipt=json.loads((here/'media-receipt.json').read_text())
assert hashlib.sha256((here/'actor-gray.mp4').read_bytes()).hexdigest()==receipt['outputSHA256']
for name in ['ledger.json','target.json','media-receipt.json','REVIEW.md']:
 target=runtime/name;temp=target.with_suffix(target.suffix+'.tmp');shutil.copy2(here/name,temp);temp.replace(target)
link=runtime/'actor-gray.mp4';source=here/'actor-gray.mp4'
if link.is_symlink():assert link.resolve()==source.resolve()
elif link.exists():raise RuntimeError('Refusing to replace unrelated runtime media')
else:link.symlink_to(source)
print(runtime)
