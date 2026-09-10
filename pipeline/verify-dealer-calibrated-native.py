"""Verify reopened native speech keys against calibrated source-clock samples."""
import bpy,json,sys,math
from pathlib import Path
p=Path(sys.argv[1]);data=json.loads((p/'facial-keyframes.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(p/'astrid-goodluck.blend'));scene=bpy.context.scene;error=0
for sample in data['frames']:
 frame=sample['frame'];scene.frame_set(math.floor(frame),subframe=frame%1)
 for obj in scene.objects:
  if obj.type!='MESH' or not obj.data.shape_keys:continue
  for name,value in sample['weights'].items():
   block=obj.data.shape_keys.key_blocks.get(name)
   if block:error=max(error,abs(block.value-value))
assert error<1e-5,error
result={'frames':len(data['frames']),'maximumWeightError':error,'rigModelSha256':data['rigModelHash'],'sourceSha256':data['sourceHash'],'status':'reopened native source-clock values verified; rendered acceptance separate'}
(p/'facial-calibrated-native-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
