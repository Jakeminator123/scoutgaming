from pathlib import Path
import shutil
here=Path(__file__).resolve().parent
runtime=here.parent/'runtime/public/astrid-single-seat'
runtime.mkdir(parents=True,exist_ok=True)
for src in (here/'harness').iterdir():
 if src.is_file():shutil.copy2(src,runtime/src.name)
shutil.copy2(here.parent/'sequence-binding.mjs',runtime/'sequence-binding.mjs')
(runtime/'adapter.mjs').write_text((here/'adapter.mjs').read_text().replace("'../sequence-binding.mjs'","'./sequence-binding.mjs'"))
lowturn=here.parents[2]
shutil.copy2(lowturn/'compositor-viewer/packed-gpu.mjs',runtime/'packed-gpu.mjs')
source=here.parents[1]/'camera-review/seven-targets/far-left-anchor/motion/release-continuation/motion-registration/full-cycle-candidate-v2/web-surface/actor-packed-3x60.mp4'
assert source.is_file(),source
link=runtime/'actor.mp4'
if link.exists():assert link.resolve()==source.resolve(),'Refusing to replace a different runtime media file'
else:link.symlink_to(source)
print(runtime)
