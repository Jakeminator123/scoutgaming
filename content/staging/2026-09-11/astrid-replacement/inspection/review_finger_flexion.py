"""Create an independent moderate flexion study; never modify source candidate."""
import bpy, math, json, hashlib, os, sys
from pathlib import Path
from mathutils import Quaternion
base=Path(__file__).resolve().parent
version=sys.argv[1] if len(sys.argv)>1 else 'v1'
source=base.parent/f'hand-study/finger-candidate-{version}/astrid-rigged.blend'
out=base/('finger-flexion-study' if version=='v1' else f'finger-flexion-study-{version}')
out.mkdir(exist_ok=True)
assert not (out/'moderate-flexion.blend').exists()
sha=lambda:hashlib.sha256(source.read_bytes()).hexdigest()
before=sha()
bpy.ops.wm.open_mainfile(filepath=str(source))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
angles={}
for side in ['Left','Right']:
 for digit in ['Thumb','Index','Middle','Ring','Pinky']:
  for j,angle in enumerate([20,30,20] if digit=='Thumb' else [25,40,25],1):
   name=f'{side}{digit}{j}'
   pb=arm.pose.bones[name];pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion((1,0,0),math.radians(angle));angles[name]=angle
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'moderate-flexion.blend'))
assert sha()==before
(out/'study.json').write_text(json.dumps({'source':str(source),'sourceSha256':before,'localXDegrees':angles,'scope':'Moderate flexion visual study, not full grip or collision acceptance'},indent=2))
os._exit(0)
