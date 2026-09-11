import bpy, runpy, json, hashlib, sys, os
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'content/staging/2026-09-11/dealer-controls'
source=root/'assets/astrid-3d/anatomical/astrid-animated.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
module=runpy.run_path(str(root/'pipeline/dealer-ik-panel.py'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE' and 'LeftHand' in o.pose.bones)
scene=bpy.context.scene
selected=arm.animation_data.action
actions=[bpy.data.actions[n] for n in ['Deal_Seat_01_Contact_Study','Deal_Seat_07_Contact_Study','Collect_Card_Study']]
result=[]
for action in actions:
 arm.animation_data.action=action
 if action.slots:arm.animation_data.action_slot=action.slots[0]
 start,end=action.frame_range
 for frac in [.38,.66]:
  scene.frame_set(round(start+(end-start)*frac));bpy.context.view_layer.update()
  for side in ['Left','Right']:
   for kind in ['WRIST','FOOT']:
    before={p.name:(arm.matrix_world@p.matrix).copy() for p in arm.pose.bones}
    residual=module['snap_ik'](arm,side,kind)
    max_head=max(((arm.matrix_world@arm.pose.bones[n].matrix).translation-m.translation).length for n,m in before.items())
    target=bpy.data.objects['CTRL_'+side.upper()+'_'+kind]
    result.append({'action':action.name,'frame':scene.frame_current,'control':target.name,'chainErrorMm':residual*1000,'allJointErrorMm':max_head*1000})
    target['IK']=0.0;module['refresh'](target)
    assert max_head < .001,result[-1]
arm.animation_data.action=selected
if selected.slots:arm.animation_data.action_slot=selected.slots[0]
scene.frame_set(1)
module['register']()
text=bpy.data.texts.get('Dealer movement controls.py') or bpy.data.texts.new('Dealer movement controls.py')
text.clear();text.write((root/'pipeline/dealer-ik-panel.py').read_text())
scene['movement_panel_help']='Text Editor: open Dealer movement controls.py and Run Script. Viewport N sidebar > Dealer. Select a frame, match pose and enable IK. Key targets and IK blend to author motion. Original FK actions are retained.'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'astrid-controls.blend'))
(out/'verification.json').write_text(json.dumps({'source':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'checks':result},indent=2))
print(json.dumps(result))
# bpy's embedded runtime segfaults during shutdown on this host after successful
# save. Flush the completed receipt and bypass interpreter teardown, not checks.
sys.stdout.flush()
os._exit(0)
