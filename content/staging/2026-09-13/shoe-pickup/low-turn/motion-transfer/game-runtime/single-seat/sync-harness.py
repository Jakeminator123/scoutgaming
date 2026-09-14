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

cropSource=source.with_name("actor-cropped-lossless-3x60.mp4")
cropLink=runtime/"actor-cropped.mp4"
if cropSource.is_file():
 if cropLink.exists():assert cropLink.resolve()==cropSource.resolve()
 else:cropLink.symlink_to(cropSource)

highSource=source.with_name("actor-cropped-high-crf14-3x60.mp4")
highLink=runtime/"actor-cropped-high.mp4"
if highSource.is_file():
 if highLink.exists():assert highLink.resolve()==highSource.resolve()
 else:highLink.symlink_to(highSource)

graySource=here/"gray-alpha/actor-rgb-rear-front-high14.mp4"
grayLink=runtime/"actor-gray.mp4"
if graySource.is_file():
 if grayLink.exists():assert grayLink.resolve()==graySource.resolve()
 else:grayLink.symlink_to(graySource)
