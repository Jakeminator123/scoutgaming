"""Preserve facial shape keys while refining the face surface and thinning subpixel hair fibers."""
from dealer_glb_materials import set_material_factor
import bpy,bmesh,json
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'content/staging/2026-09-10/astrid-head-v2';bpy.ops.wm.open_mainfile(filepath=str(OUT/'astrid-face-game.blend'))
scene=bpy.context.scene;head=bpy.data.objects['Astrid_Face'];arm=bpy.data.objects['Face_Rig'];dg=bpy.context.evaluated_depsgraph_get();keys=head.data.shape_keys.key_blocks;names=[b.name for b in keys][1:]
# Carry the anatomy author's semantic skin weights through subdivision. Height
# alone cannot distinguish the chin from the neck and caused jaw stretching.
data=OUT/'vendor/makehuman/makehuman/data';skeleton=json.loads((data/'rigs/default.mhskel').read_text())['bones'];sourceWeights=json.loads((data/'rigs/default_weights.mhw').read_text())['weights'];indices=json.loads((OUT/'head-geometry.json').read_text())['indices'];lookup={source:i for i,source in enumerate(indices)};binding=np.zeros((len(indices),3))
if len(indices)!=len(head.data.vertices):raise ValueError('Base anatomical vertex mapping changed')
for name,weights in sourceWeights.items():
 ancestor=name
 while ancestor and ancestor!='head':ancestor=skeleton.get(ancestor,{}).get('parent')
 channel=0 if ancestor=='head' else 1 if name.startswith('neck') else 2
 for source,weight in weights:
  if source in lookup:binding[lookup[source],channel]+=weight
binding/=np.maximum(binding.sum(axis=1,keepdims=True),1e-8)
for i,name in enumerate(['RigHeadWeight','RigNeckWeight','RigChestWeight']):head.data.attributes.new(name=name,type='FLOAT',domain='POINT').data.foreach_set('value',binding[:,i])
for b in keys:b.value=0
bpy.context.view_layer.update();evaluated=head.evaluated_get(dg);base=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=dg);shapes={}
for name in names:
 keys[name].value=1;bpy.context.view_layer.update();ev=head.evaluated_get(dg);mesh=ev.to_mesh();shapes[name]=np.array([v.co[:] for v in mesh.vertices]);ev.to_mesh_clear();keys[name].value=0
 if len(shapes[name])!=len(base.vertices):raise ValueError('Shape topology changed')
head.data=base
for m in list(head.modifiers):
 if m.type=='SUBSURF':head.modifiers.remove(m)
head.shape_key_add(name='Basis')
for name,points in shapes.items():
 block=head.shape_key_add(name=name)
 for v,p in zip(block.data,points):v.co=p
head.vertex_groups.clear();head.vertex_groups.new(name='Head').add(list(range(len(base.vertices))),1,'REPLACE')
# Retain every second independent hair strand; the scalp texture and silhouette remain complete.
hair=bpy.data.objects['Astrid_Hair_Fibers'];bm=bmesh.new();bm.from_mesh(hair.data);visited=set();remove=[];count=0
for vertex in bm.verts:
 if vertex in visited:continue
 stack=[vertex];component=[];visited.add(vertex)
 while stack:
  v=stack.pop();component.append(v)
  for edge in v.link_edges:
   n=edge.other_vert(v)
   if n not in visited:visited.add(n);stack.append(n)
 if count%2:remove.extend(component)
 count+=1
bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(hair.data);bm.free()
# Refine the coarse scalp cap and refit it to the head so its polygon edges do
# not protrude through the strand groom or cut a staircase into the hairline.
cap=bpy.data.objects['Astrid_Hair'];modifier=cap.modifiers.new('Smooth scalp contour','SUBSURF');modifier.levels=2;modifier.render_levels=2
bpy.context.view_layer.update();evaluated=cap.evaluated_get(bpy.context.evaluated_depsgraph_get());cap.data=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=bpy.context.evaluated_depsgraph_get())
for mod in list(cap.modifiers):
 if mod.type=='SUBSURF':cap.modifiers.remove(mod)
surface=BVHTree.FromPolygons([v.co.copy() for v in head.data.vertices],[list(p.vertices) for p in head.data.polygons])
for vertex in cap.data.vertices:
 hit,normal,index,distance=surface.find_nearest(vertex.co)
 if hit is not None:vertex.co=hit+normal*.0009
cap.vertex_groups.clear();cap.vertex_groups.new(name='Head').add(list(range(len(cap.data.vertices))),1,'REPLACE')
# Match the reference's smaller, muted blue-gray iris rather than an oversized saturated iris.
eyes=bpy.data.objects['Astrid_Eyes']
for loop in eyes.data.uv_layers.active.data:
 uv=loop.uv.copy();centers=[Vector((.702,.703)),Vector((.278,.298))];center=min(centers,key=lambda c:(uv-c).length)
 if (uv-center).length<.22:loop.uv=center+(uv-center)*1.28
mat=bpy.data.materials['Eyes_Blue'];nodes=mat.node_tree.nodes;links=mat.node_tree.links;tex=next(n for n in nodes if n.type=='TEX_IMAGE');tex.image=bpy.data.images.load(str(OUT/'vendor/system/eyes/materials/grey_eye.png'),check_existing=True);tex.image.pack();p=nodes.get('Principled BSDF');mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(.75,.9,1,1);links.new(tex.outputs['Color'],mix.inputs[1]);links.new(mix.outputs[0],p.inputs['Base Color']);links.new(tex.outputs['Alpha'],p.inputs['Alpha'])
# The reference has a dark blue-gray iris with a clear pupil, not a luminous iris.
# Bake a radial iris-only tint; keep the sclera and cornea alpha unchanged.
uv=nodes.new('ShaderNodeUVMap');uv.uv_map=eyes.data.uv_layers.active.name;distances=[]
for center in [(.702,.703,0),(.278,.298,0)]:
 distance=nodes.new('ShaderNodeVectorMath');distance.operation='DISTANCE';links.new(uv.outputs[0],distance.inputs[0]);distance.inputs[1].default_value=center;distances.append(distance)
minimum=nodes.new('ShaderNodeMath');minimum.operation='MINIMUM';links.new(distances[0].outputs['Value'],minimum.inputs[0]);links.new(distances[1].outputs['Value'],minimum.inputs[1]);mask=nodes.new('ShaderNodeMapRange');mask.clamp=True;mask.inputs['From Min'].default_value=.085;mask.inputs['From Max'].default_value=.116;mask.inputs['To Min'].default_value=1;mask.inputs['To Max'].default_value=0;links.new(minimum.outputs[0],mask.inputs['Value'])
mix.inputs[2].default_value=(.35,.43,.5,1);tint=nodes.new('ShaderNodeMixRGB');links.new(mask.outputs[0],tint.inputs[0]);links.new(tex.outputs['Color'],tint.inputs[1]);links.new(mix.outputs[0],tint.inputs[2]);links.new(tint.outputs[0],p.inputs['Base Color'])
target=bpy.data.images.new('Astrid_Iris_BaseColor',width=1024,height=1024,alpha=True);target.colorspace_settings.name='sRGB';target.filepath_raw=str(OUT/'astrid-iris-basecolor.png');target.file_format='PNG';bake=nodes.new('ShaderNodeTexImage');bake.image=target;nodes.active=bake
output=nodes.get('Material Output');emission=nodes.new('ShaderNodeEmission');links.new(tint.outputs[0],emission.inputs['Color']);links.new(emission.outputs[0],output.inputs['Surface']);scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.threads_mode='FIXED';scene.render.threads=4;bpy.ops.object.select_all(action='DESELECT');eyes.select_set(True);bpy.context.view_layer.objects.active=eyes;bpy.ops.object.bake(type='EMIT',margin=8,use_clear=True);target.save();target.pack();links.new(p.outputs[0],output.inputs['Surface']);links.new(bake.outputs['Color'],p.inputs['Base Color']);links.new(uv.outputs[0],bake.inputs[0]);p.inputs['Roughness'].default_value=.3
# Close the anatomical resting jaw slightly; retain each expression's actual delta.
for obj in scene.objects:
 if obj.type!='MESH' or not obj.data.shape_keys:continue
 blocks=obj.data.shape_keys.key_blocks;basis=np.array([v.co[:] for v in blocks[0].data]);delta=np.zeros_like(basis)
 if 'jawOpen' in blocks:delta-=.06*(np.array([v.co[:] for v in blocks['jawOpen'].data])-basis)
 if obj.name in ['Astrid_Face','Astrid_Eyelashes']:
  for name in ['eyeBlinkLeft','eyeBlinkRight']:
   if name in blocks:delta+=.035*(np.array([v.co[:] for v in blocks[name].data])-basis)
 for block in blocks:
  points=np.array([v.co[:] for v in block.data])+delta;block.data.foreach_set('co',points.ravel())
for o in scene.objects:
 if o.type=='MESH':
  world=o.matrix_world.copy();o.parent=arm;bpy.context.view_layer.update();o.matrix_world=world
  o.hide_set(False)
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
 if o.type in ['MESH','ARMATURE']:o.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'astrid-face-ready.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'astrid-face-ready.glb'),export_format='GLB',use_selection=True,export_apply=False,export_animations=False,export_morph=True,export_morph_normal=True,export_skins=True,export_materials='EXPORT')
set_material_factor(OUT/'astrid-face-ready.glb','Eyes_Blue',[1,1,1,1])
(OUT/'optimization.json').write_text(json.dumps({'facialVertices':len(base.vertices),'facialShapeKeys':names,'sourceHairStrands':count,'retainedHairStrands':(count+1)//2,'hairVertices':len(hair.data.vertices),'status':'optimized candidate; browser review required'},indent=2));print('Ready candidate exported')
