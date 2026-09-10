"""Add opt-in IK controls while retaining the verified FK animation actions."""
import json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
folder=Path(sys.argv[1]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(folder/'astrid-animated.blend'))
scene=bpy.context.scene;scene.frame_set(1)
arm=next(o for o in scene.objects if o.type=='ARMATURE')
collection=bpy.data.collections['DEALER_CONTROLS']
def obj(name,location):
    o=bpy.data.objects.get(name)
    if o is None:o=bpy.data.objects.new(name,None);collection.objects.link(o)
    o.location=location;o.empty_display_type='CIRCLE';o.empty_display_size=.075;o.show_in_front=True
    return o
def world_head(name):return arm.matrix_world@arm.pose.bones[name].head
def drive(c,control):
    control['IK']=0.0;control.id_properties_ui('IK').update(min=0,max=1,description='0 plays baked FK actions; 1 enables this editable IK control')
    f=c.driver_add('influence');v=f.driver.variables.new();v.name='ik';v.targets[0].id=control;v.targets[0].data_path='["IK"]';f.driver.expression='ik'
results=[]
for side in ['Left','Right']:
    for kind,upper,lower,end in [('WRIST',side+'Arm',side+'ForeArm',side+'Hand'),('FOOT',side+'UpLeg',side+'Leg',side+'Foot')]:
        target=obj('CTRL_'+side.upper()+'_'+kind,world_head(end));target.rotation_mode='QUATERNION';target.rotation_quaternion=(arm.matrix_world@arm.pose.bones[end].matrix).to_quaternion()
        a,b,c=world_head(upper),world_head(lower),world_head(end);direction=(c-a).normalized();bend=(b-a)-direction*(b-a).dot(direction)
        if bend.length<1e-5:bend=Vector((0,-1,0))
        pole=obj('CTRL_'+side.upper()+('_ELBOW' if kind=='WRIST' else '_KNEE'),b+bend.normalized()*.25)
        constraints=arm.pose.bones[lower].constraints
        for old in list(constraints):
            if old.type=='IK':constraints.remove(old)
        ik=constraints.new('IK');ik.name='Dealer '+kind+' IK';ik.target=target;ik.pole_target=pole;ik.chain_count=2;ik.use_stretch=False
        # Solve pole roll against the current authored elbow/knee, then preserve FK.
        best=(float('inf'),0)
        for n in range(72):
            angle=-math.pi+n*math.tau/72;ik.pole_angle=angle;bpy.context.view_layer.update()
            error=(world_head(lower)-b).length
            if error<best[0]:best=(error,angle)
        ik.pole_angle=best[1]
        bpy.context.view_layer.update()
        baseline=(world_head(end)-target.location).length
        target.location+=Vector((0,-.005,.005));bpy.context.view_layer.update();moved=(world_head(end)-target.location).length
        target.location-=Vector((0,-.005,.005));drive(ik,target)
        rotation=arm.pose.bones[end].constraints.new('COPY_ROTATION');rotation.name='Dealer '+kind+' orientation';rotation.target=target;rotation.target_space='WORLD';rotation.owner_space='WORLD';drive(rotation,target)
        results.append({'control':target.name,'restTargetErrorMm':baseline*1000,'movedTargetErrorMm':moved*1000,'default':'FK; set IK to1 to move this target'})
        bpy.context.view_layer.update()
body=bpy.data.objects['CTRL_BODY'];body.location=(0,0,0);body.empty_display_size=.22
world=arm.matrix_world.copy();arm.parent=body;arm.matrix_world=world
body['purpose']='Global body/root transform. Foot and wrist controls remain world-space when IK is enabled.'
head=obj('CTRL_HEAD_ROTATION',world_head('Head'));head.rotation_mode='QUATERNION';head.rotation_quaternion=(arm.matrix_world@arm.pose.bones['Head'].matrix).to_quaternion()
rotation=arm.pose.bones['Head'].constraints.new('COPY_ROTATION');rotation.name='Editable head orientation';rotation.target=head;rotation.target_space='WORLD';rotation.owner_space='WORLD';drive(rotation,head)
look=bpy.data.objects.get('CTRL_LOOK')
if look:bpy.data.objects.remove(look,do_unlink=True)
scene['control_help']='CTRL_BODY moves root. CTRL_LEFT/RIGHT_WRIST and FOOT have IK blend0..1;0 retains baked actions. Elbow/knee poles control bend. CTRL_HEAD_ROTATION IK1 enables head rotation. Finger FK bones named Left/Right Thumb/Index/Middle/Ring/Pinky1..3. No eye or facial deformation rig.'
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'astrid-animated.blend'))
(folder/'control-verification.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
