"""Import a generated skinned dealer without discarding weights or material maps.

Run with a Python containing bpy. Source and editable controls are saved separately.
No generated result is marked visually approved by this preparation step.
"""
import argparse
import json
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('source')
parser.add_argument('--output', required=True)
parser.add_argument('--inspect-only', action='store_true')
args = parser.parse_args()
output = Path(args.output).resolve()
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(args.source).resolve()))
armatures = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
report = {
    'source': Path(args.source).name,
    'meshes': [{'name':o.name,'vertices':len(o.data.vertices),'polygons':len(o.data.polygons),
                'vertexGroups':len(o.vertex_groups),'materials':[m.name for m in o.data.materials if m],
                'shapeKeys':list(o.data.shape_keys.key_blocks.keys()) if o.data.shape_keys else [],
                'bounds':[list(o.matrix_world @ Vector(p)) for p in o.bound_box]} for o in meshes],
    'armatures': [{'name':a.name,'bones':[{'name':b.name,'parent':b.parent.name if b.parent else None,
                  'head':list(a.matrix_world @ b.head_local),'tail':list(a.matrix_world @ b.tail_local)} for b in a.data.bones]} for a in armatures],
    'animations': [a.name for a in bpy.data.actions],
    'images': [{'name':im.name,'size':list(im.size),'packed':bool(im.packed_file)} for im in bpy.data.images],
    'status':'unreviewed',
}
(output/'source-inspection.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
if args.inspect_only:
    raise SystemExit()
if len(armatures) != 1:
    raise RuntimeError(f'Expected one weighted humanoid armature, received {len(armatures)}')
arm=armatures[0]
if not any(len(m.vertex_groups) for m in meshes):
    raise RuntimeError('Model has no skin weights; do not substitute a rigid figure')
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(output/'astrid-source.blend'))

# Provider export carries metallic=1 on skin/fabric and centimetre bone display
# lengths inflated 100 times. Preserve source, then repair the editable rig.
for m in bpy.data.materials:
    if m.use_nodes:
        for node in m.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                node.inputs['Metallic'].default_value=0
                node.inputs['Roughness'].default_value=.72
                node.inputs['Emission Strength'].default_value=0
                for link in list(node.inputs['Emission Color'].links):m.node_tree.links.remove(link)
                node.inputs['Emission Color'].default_value=(0,0,0,1)
                node.inputs['Specular Tint'].default_value=(1,1,1,1)
for o in list(bpy.context.scene.objects):
    if o.type=='MESH' and not o.vertex_groups and o.name=='Icosphere':
        bpy.data.objects.remove(o,do_unlink=True)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.context.view_layer.objects.active=arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for b in arm.data.edit_bones:
    b.length=max(.6,b.length*.01)
bpy.ops.object.mode_set(mode='OBJECT')

def find(*candidates):
    lookup={b.name.lower().replace('mixamorig:','').replace('mixamorig','').replace('_','').replace('-',''):b.name for b in arm.data.bones}
    for c in candidates:
        key=c.lower().replace('_','').replace('-','')
        if key in lookup:
            return lookup[key]
    raise RuntimeError(f'Missing required joint: {candidates}; inspect source-inspection.json')

mapping={
    'hips':find('Hips','pelvis'),
    'head':find('Head'),
    'leftUpperArm':find('LeftArm','upperarm_l','LeftUpperArm'),
    'leftForeArm':find('LeftForeArm','lowerarm_l','LeftLowerArm'),
    'leftHand':find('LeftHand','hand_l'),
    'rightUpperArm':find('RightArm','upperarm_r','RightUpperArm'),
    'rightForeArm':find('RightForeArm','lowerarm_r','RightLowerArm'),
    'rightHand':find('RightHand','hand_r'),
}

# Landmark coordinates measured from the orthographic source-hand render.
# Each chain follows an actual separate digit, retaining the provider hand mesh.
digit_landmarks={
 'Thumb':((-.357,.952),(-.378,.938),(-.394,.923),(-.404,.916)),
 'Index':((-.376,.903),(-.384,.881),(-.390,.863),(-.394,.849)),
 'Middle':((-.361,.900),(-.366,.874),(-.370,.853),(-.373,.838)),
 'Ring':((-.348,.901),(-.350,.877),(-.353,.857),(-.355,.842)),
 'Pinky':((-.334,.900),(-.335,.882),(-.336,.868),(-.336,.857)),
}
body=next(o for o in meshes if o.vertex_groups)
points=np.array([body.matrix_world @ v.co for v in body.data.vertices])
fingers={}
bpy.ops.object.mode_set(mode='EDIT')
for side in ['right','left']:
    hand_name=mapping[side+'Hand']
    group=body.vertex_groups.get(hand_name)
    hand_indices=[v.index for v in body.data.vertices if any(g.group==group.index and g.weight>.35 for g in v.groups)]
    hand_points=points[hand_indices]
    segments=[]
    for digit,landmarks in digit_landmarks.items():
        joints=[]
        for x,z in landmarks:
            if side=='left':x=-x+.003
            near=np.argsort((hand_points[:,0]-x)**2+(hand_points[:,2]-z)**2)[:20]
            y=float(np.median(hand_points[near,1]))
            joints.append(Vector((x,y,z)))
        parent=arm.data.edit_bones[hand_name]
        for j in range(3):
            name=side.capitalize()+digit+str(j+1)
            b=arm.data.edit_bones.new(name)
            b.head=arm.matrix_world.inverted() @ joints[j]
            b.tail=arm.matrix_world.inverted() @ joints[j+1]
            b.parent=parent;b.use_deform=True
            parent=b
            segments.append((name,np.array(joints[j]),np.array(joints[j+1]),j))
    fingers[side]={'segments':segments,'indices':hand_indices,'group':group.index}
bpy.ops.object.mode_set(mode='OBJECT')
for side,data in fingers.items():
    for name,a,b,j in data['segments']:
        body.vertex_groups.new(name=name)
    for vi in data['indices']:
        p=points[vi]
        candidates=[]
        for name,a,b,j in data['segments']:
            delta=b-a;u=float(np.dot(p-a,delta)/np.dot(delta,delta))
            nearest=a+np.clip(u,0,1)*delta
            candidates.append((float(np.linalg.norm(p-nearest)),name,u,j))
        candidates.sort()
        d,name,u,j=candidates[0]
        # Leave palm, wrist and webbing mostly on the existing hand bone.
        amount=min(1,max(0,(u+.12)/.6)) if j==0 else 1
        amount*=min(1,max(0,(.019-d)/.007))
        if amount<=.001:continue
        vertex=body.data.vertices[vi]
        original=[(g.group,g.weight) for g in vertex.groups]
        hand_weight=next((w for g,w in original if g==data['group']),0)
        body.vertex_groups[data['group']].add([vi],hand_weight*(1-amount),'REPLACE')
        body.vertex_groups[name].add([vi],hand_weight*amount,'REPLACE')
for o in meshes:
    for poly in o.data.polygons:poly.use_smooth=True
mapping['fingers']={side:[n for n,_,_,_ in d['segments']] for side,d in fingers.items()}
controls=bpy.data.collections.new('DEALER_CONTROLS')
bpy.context.scene.collection.children.link(controls)
def control(name,location,size=.08):
    obj=bpy.data.objects.new(name,None)
    controls.objects.link(obj)
    obj.empty_display_type='CIRCLE'
    obj.empty_display_size=size
    obj.location=location
    obj.show_in_front=True
    return obj

for side in ['left','right']:
    hand=arm.data.bones[mapping[side+'Hand']]
    upper=arm.data.bones[mapping[side+'UpperArm']]
    wrist=control('CTRL_'+side.upper()+'_WRIST',arm.matrix_world @ hand.head_local)
    wrist['purpose']='Move wrist. Forearm IK preserves imported skin weights.'
    pole=control('CTRL_'+side.upper()+'_ELBOW',arm.matrix_world @ upper.head_local+Vector((.25 if side=='left' else -.25,.3,-.25)))
    ik=arm.pose.bones[mapping[side+'ForeArm']].constraints.new('IK')
    ik.name='Dealer arm control (enable for authored poses)'
    ik.target=wrist
    ik.pole_target=pole
    ik.chain_count=2
    ik.use_stretch=False
    # Keep delivered rest geometry intact; animator enables IK per authored shot.
    ik.influence=0
    wrist['IK_influence_bone']=mapping[side+'ForeArm']

control('CTRL_BODY',arm.matrix_world @ arm.data.bones[mapping['hips']].head_local,.18)
control('CTRL_LOOK',arm.matrix_world @ arm.data.bones[mapping['head']].head_local+Vector((0,-1,0)),.06)
scene=bpy.context.scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.render.fps=30;scene.frame_start=1;scene.frame_end=50
scene['review_status']='Unreviewed source identity, skin and contact. Controls are editable; no full facial rig claimed.'
bpy.ops.wm.save_as_mainfile(filepath=str(output/'astrid-rigged.blend'))
bpy.ops.export_scene.gltf(filepath=str(output/'astrid-rigged.glb'),export_format='GLB',export_animations=True,export_extras=True)
profile={'version':1,'status':'unreviewed','bones':mapping,'vertices':sum(len(m.data.vertices) for m in meshes),
         'polygons':sum(len(m.data.polygons) for m in meshes),'sourceJob':'cc1a080e-8d37-4f3c-847d-5f70bf1c3125',
         'limitations':['No facial blend shapes or phoneme approval.','Finger chains added from source hand landmarks; curl and contact require visual review.','Original source preserved separately; generated mesh is not a hand-sculpted master.']}
(output/'profile.json').write_text(json.dumps(profile,indent=2))
