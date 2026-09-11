"""Build an isolated playable preview without copying or opening user databases."""
from pathlib import Path
import shutil, os
repo=Path(__file__).resolve().parents[5]
runtime=Path(__file__).resolve().parent/'runtime'
runtime.mkdir(exist_ok=True)
for source in (repo/'web').glob('*.mjs'):
    shutil.copy2(source,runtime/source.name)
public=runtime/'public'; public.mkdir(exist_ok=True)
for source in (repo/'web/public').iterdir():
    target=public/source.name
    if source.is_dir():
        if not target.exists() and not target.is_symlink(): target.symlink_to(source,target_is_directory=True)
    else: shutil.copy2(source,target)
print(runtime)
# Private source path: the public dealer manifests and shipped renderer stay intact.
scene=public/'rigged-table-scene.mjs'
s=scene.read_text().replace("const rigFolder=faceStudy?'dealers/astrid/rig/face-study/':'dealers/astrid/rig/';","const rigFolder='candidate/';")
s=s.replace("  if(faceStudy){\n    // A broad", "  if(true){\n    // A broad")
s=s.replace("  if(faceStudy){\n    try{\n      const texture", "  if(true){\n    try{\n      const texture")
scene.write_text(s)
# This source's eyes already look slightly upward. Keep the motion trial's
# head nearer the felt and use visible digit flexion instead of the old .03 curl.
controller=public/'dealer-rig.mjs'
s=controller.read_text().replace('rig.raiseGaze(.28+.34*reachWeight)','rig.raiseGaze(.05+.22*reachWeight)')
s=s.replace('rig.curl(side,grip*.03)','rig.curl(side,grip*.16)')
s=s.replace("rig.curl(side,sample[side+'Grip']*.03)","rig.curl(side,sample[side+'Grip']*.16)")
controller.write_text(s)

shutil.copy2(Path(__file__).parent/'candidate-proof.mjs',public/'candidate-proof.mjs')
index=public/'index.html'
s=index.read_text()
if 'candidate-proof.mjs' not in s:s=s.replace('</body>', '<script type="module" src="candidate-proof.mjs"></script></body>')
index.write_text(s)
scene=public/'rigged-table-scene.mjs';s=scene.read_text().replace('canvas,alpha:false,antialias:true','canvas,alpha:false,antialias:true,preserveDrawingBuffer:true');scene.write_text(s)

scene=public/'rigged-table-scene.mjs';s=scene.read_text()
needle='  resize();syncCards();requestAnimationFrame(render);'
replacement="  window.addEventListener('candidate-render-now',()=>{if(!active)poseDealer(rig,0,tableProfile.seatCards[3],outlet);renderer.render(scene,camera);canvas.toBlob(blob=>{if(blob)window.dispatchEvent(new CustomEvent('candidate-frame',{detail:blob}));},'image/png');});\n"+needle
assert needle in s, 'Review render hook changed; inspect the current scene before rebuilding'
s=s.replace(needle,replacement,1);scene.write_text(s)
