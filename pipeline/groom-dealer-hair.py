"""Replace the coarse hair-card cap with a fitted scalp and individually modeled strands."""
import bpy,math,random,numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'media/dealers/astrid/staging/2026-09-10/astrid-head-v2';bpy.ops.wm.open_mainfile(filepath=str(OUT/'astrid-face-textured.blend'))
scene=bpy.context.scene;head=bpy.data.objects['Astrid_Face'];camera=bpy.data.objects['Identity_Camera'];bpy.context.view_layer.update();project=camera.calc_matrix_camera(bpy.context.evaluated_depsgraph_get(),x=900,y=1100)@camera.matrix_world.inverted()
def scalp_point(v):
 c=project@v.co.to_4d();x=(c.x/c.w+1)*450;y=(1-c.y/c.w)*550
 if v.co.y>.025:return v.co.z>1.625
 if abs(v.co.x)>.073:return v.co.z>1.66
 return y<150+.0016*(x-435)**2 and v.co.z>1.70
selected=[p for p in head.data.polygons if all(scalp_point(head.data.vertices[i]) for i in p.vertices)]
ids=sorted({i for p in selected for i in p.vertices});lookup={i:j for j,i in enumerate(ids)}
mesh=bpy.data.meshes.new('Fitted_Scalp');mesh.from_pydata([head.data.vertices[i].co+head.data.vertices[i].normal*.0008 for i in ids],[],[[lookup[i] for i in p.vertices] for p in selected]);mesh.update();scalp=bpy.data.objects.new('Astrid_Hair',mesh)
old=bpy.data.objects.get('Astrid_Hair');bpy.data.objects.remove(old,do_unlink=True);scalp.name='Astrid_Hair';scene.collection.objects.link(scalp)
uv=mesh.uv_layers.new(name='Identity_Texture');mask=mesh.color_attributes.new(name='Identity_Texture_Weight',type='FLOAT_COLOR',domain='CORNER');uv=mesh.uv_layers['Identity_Texture'];srcuv=head.data.uv_layers['Identity_Texture'];srcmask=head.data.color_attributes['Identity_Texture_Weight']
for p,source in zip(mesh.polygons,selected):
 p.use_smooth=True
 for li,sli in zip(p.loop_indices,source.loop_indices):uv.data[li].uv=srcuv.data[sli].uv;mask.data[li].color=srcmask.data[sli].color
mat=bpy.data.materials.new('Groomed_Blonde_Scalp');mat.use_nodes=True;n=mat.node_tree.nodes;l=mat.node_tree.links;p=n.get('Principled BSDF');p.inputs['Roughness'].default_value=.43;p.inputs['Anisotropic'].default_value=.45
tex=n.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(OUT/'astrid-neutral-reference.png'),check_existing=True);tex.image.pack();uvn=n.new('ShaderNodeUVMap');uvn.uv_map='Identity_Texture';l.new(uvn.outputs['UV'],tex.inputs['Vector']);attr=n.new('ShaderNodeVertexColor');attr.layer_name='Identity_Texture_Weight';mix=n.new('ShaderNodeMixRGB');mix.inputs[1].default_value=(.15,.09,.038,1);l.new(attr.outputs[0],mix.inputs[0]);l.new(tex.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],p.inputs['Base Color']);mesh.materials.append(mat)
sub=scalp.modifiers.new('Smooth_Scalp','SUBSURF');sub.levels=1;sub.render_levels=2
# Model fibers on the actual anatomical surface, then flow toward the back tie.
bvh=BVHTree.FromPolygons([v.co for v in head.data.vertices],[list(p.vertices) for p in head.data.polygons]);center=Vector((0,.022,1.685));rng=random.Random(417)
curve=bpy.data.curves.new('Combed_Hair_Strands','CURVE');curve.dimensions='3D';curve.resolution_u=1;curve.bevel_depth=.000035;curve.bevel_resolution=0;curve.resolution_u=1
for i in range(6):
 m=bpy.data.materials.new('Hair_Fiber_'+str(i));m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');t=i/5;p.inputs['Base Color'].default_value=(.075+.10*t,.038+.062*t,.013+.028*t,1);p.inputs['Roughness'].default_value=.39;p.inputs['Anisotropic'].default_value=.55;curve.materials.append(m)
root_faces=[p for p in selected if p.center.y<.05 and p.center.z>1.68]
def sample_root():
 poly=rng.choice(root_faces);corners=[head.data.vertices[i].co for i in poly.vertices];u=rng.random();v=rng.random();return corners[0].lerp(corners[1],u).lerp(corners[-1].lerp(corners[-2],u),v)
for i in range(1400):
 root=sample_root();a=(root-center).normalized();end=Vector((rng.uniform(-.015,.015),.12,1.64));b=(end-center).normalized();spline=curve.splines.new('POLY');spline.points.add(23);spline.material_index=rng.randrange(6)
 for j,point in enumerate(spline.points):
  t=j/23;arch=Vector((a.x*.25,0,1));direction=(a*(1-t)**2+arch*(2*t*(1-t)*1.4)+b*t*t).normalized();hit,normal,face,distance=bvh.ray_cast(center,direction,.4)
  if hit is None:hit=root.lerp(end,t);normal=direction
  co=hit+normal*(.0012+.0005*math.sin(math.pi*t)+rng.uniform(0,.00025));point.co=(*co,1);point.radius=.65+.35*math.sin(math.pi*(.1+.8*t))
# Neat compact bun behind the head, with varied strand endings.
for i in range(250):
 spline=curve.splines.new('POLY');spline.points.add(23);spline.material_index=rng.randrange(6);phase=rng.random()*math.tau;radius=rng.uniform(.010,.024)
 for j,p in enumerate(spline.points):
  t=j/23;angle=phase+t*math.pi*1.6;p.co=(radius*math.cos(angle),.113+.009*math.sin(math.pi*t),1.648+radius*math.sin(angle),1);p.radius=.8*(1-t*.65)
fibers=bpy.data.objects.new('Astrid_Hair_Fibers',curve);scene.collection.objects.link(fibers)
arm=bpy.data.objects['Face_Rig'];group=scalp.vertex_groups.new(name='Head');group.add(list(range(len(mesh.vertices))),1,'REPLACE');mod=scalp.modifiers.new('Face_Rig','ARMATURE');mod.object=arm
# Bone-parent strands with explicit world preservation for native animation.
world=fibers.matrix_world.copy();fibers.parent=arm;fibers.parent_type='BONE';fibers.parent_bone='Head';bpy.context.view_layer.update();fibers.matrix_world=world
eye=bpy.data.materials['Eyes_Blue'];nodes=eye.node_tree.nodes;links=eye.node_tree.links;bsdf=nodes.get('Principled BSDF');base=bsdf.inputs['Base Color'].links[0].from_socket;hsv=nodes.new('ShaderNodeHueSaturation');hsv.inputs['Saturation'].default_value=.25;hsv.inputs['Value'].default_value=.8;links.new(base,hsv.inputs['Color']);links.new(hsv.outputs[0],bsdf.inputs['Base Color'])
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'astrid-face-groomed.blend'));print('Scalp polygons',len(selected),'strands',len(curve.splines))
