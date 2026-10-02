"""Bake native face/scalp materials to game UVs and export editable facial morph targets."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'media/dealers/astrid/staging/2026-09-10/astrid-head-v2';bpy.ops.wm.open_mainfile(filepath=str(OUT/'astrid-face-groomed.blend'))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.threads_mode='FIXED';scene.render.threads=6
for obj in scene.objects:
 if obj.type=='MESH' and obj.data.shape_keys:
  for b in obj.data.shape_keys.key_blocks:b.value=0
for name,size in [('Astrid_Face',3072),('Astrid_Hair',2048)]:
 obj=bpy.data.objects[name];mesh=obj.data;mat=mesh.materials[0];mat.use_fake_user=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links
 # Pin every existing sampler before adding a fresh full-head UV layout.
 olduv=mesh.uv_layers.active.name
 for n in nodes:
  if n.type=='TEX_IMAGE' and not n.inputs['Vector'].is_linked:
   uv=nodes.new('ShaderNodeUVMap');uv.uv_map=olduv;links.new(uv.outputs['UV'],n.inputs['Vector'])
 bpy.ops.object.select_all(action='DESELECT');obj.hide_set(False);obj.select_set(True);bpy.context.view_layer.objects.active=obj;obj.active_shape_key_index=0
 layer=mesh.uv_layers.new(name='GameUV');mesh.uv_layers.active=layer;layer.active_render=True
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.012);bpy.ops.object.mode_set(mode='OBJECT')
 target=bpy.data.images.new(name+'_BaseColor',width=size,height=size,alpha=True);target.colorspace_settings.name='sRGB';target.filepath_raw=str(OUT/(name.lower()+'-basecolor.png'));target.file_format='PNG'
 bake=nodes.new('ShaderNodeTexImage');bake.image=target;nodes.active=bake
 bsdf=nodes.get('Principled BSDF');surface=nodes.get('Material Output');original=surface.inputs['Surface'].links[0].from_socket;base=bsdf.inputs['Base Color'].links[0].from_socket;emission=nodes.new('ShaderNodeEmission');links.new(base,emission.inputs['Color']);links.new(emission.outputs[0],surface.inputs['Surface'])
 bpy.ops.object.bake(type='EMIT',margin=16,use_clear=True);links.new(original,surface.inputs['Surface']);target.save();target.pack()
 game=bpy.data.materials.new(name+'_Game');game.use_nodes=True;n=game.node_tree.nodes;l=game.node_tree.links;p=n.get('Principled BSDF');p.inputs['Roughness'].default_value=.43
 if name=='Astrid_Face':p.inputs['Subsurface Weight'].default_value=.12;p.inputs['Subsurface Scale'].default_value=.004;p.inputs['Subsurface Radius'].default_value=(1,.35,.15)
 tex=n.new('ShaderNodeTexImage');tex.image=target;uv=n.new('ShaderNodeUVMap');uv.uv_map='GameUV';l.new(uv.outputs[0],tex.inputs[0]);l.new(tex.outputs[0],p.inputs['Base Color']);mesh.materials.clear();mesh.materials.append(game)
 print('Baked',name,flush=True)
# Export eye atlas directly with its transparency. Native source retains the richer shader study.
eye=bpy.data.materials['Eyes_Blue'];nodes=eye.node_tree.nodes;links=eye.node_tree.links;p=nodes.get('Principled BSDF');tex=next(n for n in nodes if n.type=='TEX_IMAGE');links.new(tex.outputs['Color'],p.inputs['Base Color'])
# Convert fiber curves to genuine exportable geometry and bind them to the head.
fibers=bpy.data.objects['Astrid_Hair_Fibers'];bpy.ops.object.select_all(action='DESELECT');fibers.select_set(True);bpy.context.view_layer.objects.active=fibers;bpy.ops.object.convert(target='MESH');fibers=bpy.context.object;bpy.context.view_layer.update();world=fibers.matrix_world.copy();fibers.parent=None;fibers.matrix_world=world
arm=bpy.data.objects['Face_Rig'];group=fibers.vertex_groups.new(name='Head');group.add(list(range(len(fibers.data.vertices))),1,'REPLACE');mod=fibers.modifiers.new('Face_Rig','ARMATURE');mod.object=arm
# Independent eye bones provide genuine gaze controls.
eyes=bpy.data.objects['Astrid_Eyes'];bpy.context.view_layer.objects.active=arm;bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
centers={}
for side,sign in [('Left',1),('Right',-1)]:
 vertices=[v.co for v in eyes.data.vertices if v.co.x*sign>0];center=sum(vertices,Vector())/len(vertices);bone=arm.data.edit_bones.new('Eye'+side);bone.head=center;bone.tail=center+Vector((0,-.015,0));bone.parent=arm.data.edit_bones['Head'];centers[side]=center
bpy.ops.object.mode_set(mode='OBJECT');eyes.vertex_groups.clear()
for side,sign in [('Left',1),('Right',-1)]:eyes.vertex_groups.new(name='Eye'+side).add([v.index for v in eyes.data.vertices if v.co.x*sign>0],1,'REPLACE')
# Hidden optional duplicate eyebrows are retained only in the pre-export source.
brows=bpy.data.objects.get('Astrid_Eyebrows')
if brows:bpy.data.objects.remove(brows,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
 if o.type in ['MESH','ARMATURE']:o.hide_set(False);o.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'astrid-face-game.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'astrid-face.glb'),export_format='GLB',use_selection=True,export_apply=False,export_animations=False,export_morph=True,export_morph_normal=True,export_skins=True,export_materials='EXPORT')
(OUT/'export-profile.json').write_text(json.dumps({'status':'game candidate, rendered integration pending','gazeBones':['EyeLeft','EyeRight'],'shapeKeys':[b.name for b in bpy.data.objects['Astrid_Face'].data.shape_keys.key_blocks][1:],'meshVertices':{o.name:len(o.data.vertices) for o in scene.objects if o.type=='MESH'},'source':'MakeHuman core CC0 anatomy; Astrid reference-based identity fit and neutral-light texture; modeled hair fibers'},indent=2));print('Saved editable native and GLB facial candidate')
