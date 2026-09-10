"""Attach the accepted-for-review anatomical face candidate to Astrid's existing body rig.
Produces separate v2 staging assets; original body, motions and public route are untouched.
"""
from dealer_glb_materials import set_material_factor
import bpy,bmesh,json,math,numpy as np
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'content/staging/2026-09-10/astrid-head-v2';DEST=OUT/'combined';DEST.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/astrid-3d/astrid-rigged.blend'));scene=bpy.context.scene;arm=next(o for o in scene.objects if o.type=='ARMATURE');body=next(o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers));body_name=body.name
if arm.animation_data:arm.animation_data.action=None
for b in arm.pose.bones:b.matrix_basis.identity()
bpy.context.view_layer.update()
# Record retained body geometry and weights before removing only obsolete head/neck skin.
def signature(v):return tuple(sorted((body.vertex_groups[g.group].name,round(g.weight,6)) for g in v.groups))
original={tuple(round(c,6) for c in v.co):signature(v) for v in body.data.vertices}
headGroup=body.vertex_groups['Head'].index;oldHeadWeights=[sum(g.weight for g in v.groups if g.group==headGroup) for v in body.data.vertices]
image=next(n.image for n in body.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE');pixels=np.asarray(image.pixels[:]).reshape(image.size[1],image.size[0],4);uv=body.data.uv_layers[0]
loopids=np.empty(len(body.data.loops),dtype=np.int32);body.data.loops.foreach_get('vertex_index',loopids);uvs=np.empty(len(loopids)*2,dtype=np.float32);uv.data.foreach_get('uv',uvs);uvs=uvs.reshape((-1,2));ix=np.clip(uvs[:,0]*image.size[0],0,image.size[0]-1).astype(int);iy=np.clip(uvs[:,1]*image.size[1],0,image.size[1]-1).astype(int);colors=np.zeros((len(body.data.vertices),3));colors[loopids]=pixels[iy,ix,:3]
bm=bmesh.new();bm.from_mesh(body.data);bm.verts.ensure_lookup_table();remove=[]
for v in bm.verts:
 w=body.matrix_world@v.co;r,g,b=colors[v.index]
 if w.z>1.515 or (w.z>1.485 and w.y<-.055) or (w.z>1.45 and oldHeadWeights[v.index]>.85):remove.append(v)
bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(body.data);bm.free()
uv=body.data.uv_layers[0] # to_mesh invalidates the earlier RNA layer wrapper.
retainedMismatch=sum(signature(v)!=original.get(tuple(round(c,6) for c in v.co)) for v in body.data.vertices)
if retainedMismatch:raise ValueError('Body geometry or weights changed unexpectedly')
names=['Face_Rig','Astrid_Face','Astrid_Eyes','Astrid_Teeth','Astrid_Tongue','Astrid_Eyelashes','Astrid_Hair','Astrid_Hair_Fibers']
with bpy.data.libraries.load(str(OUT/'astrid-face-ready.blend'),link=False) as (src,dst):dst.objects=names.copy()
for o in dst.objects:
 if o:scene.collection.objects.link(o)
facearm=bpy.data.objects['Face_Rig'];facearm.location.z-=.05;bpy.context.view_layer.update()
eyeWorld={name:(facearm.matrix_world@facearm.data.bones[name].head_local,facearm.matrix_world@facearm.data.bones[name].tail_local) for name in ['EyeLeft','EyeRight']}
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
for name,(a,b) in eyeWorld.items():
 bone=arm.data.edit_bones.new(name);bone.head=arm.matrix_world.inverted()@a;bone.tail=arm.matrix_world.inverted()@b;bone.parent=arm.data.edit_bones['Head']
bpy.ops.object.mode_set(mode='OBJECT')
for name in names[1:]:
 obj=bpy.data.objects[name];world=obj.matrix_world.copy();obj.parent=arm;obj.matrix_world=world
 for mod in obj.modifiers:
  if mod.type=='ARMATURE':mod.object=arm
# Preserve the original shirt/neck surface and tuck the replacement neck into it.
# A color-threshold deletion made a visibly serrated collar and removed shirt pixels.
head=bpy.data.objects['Astrid_Face'];bpy.ops.object.select_all(action='DESELECT');head.select_set(True);bpy.context.view_layer.objects.active=head;head.active_shape_key_index=0;bpy.ops.object.mode_set(mode='EDIT');bm=bmesh.from_edit_mesh(head.data)
remove=[]
for v in bm.verts:
 w=head.matrix_world@v.co
 if w.z<1.40:remove.append(v)
bmesh.ops.delete(bm,geom=remove,context='VERTS');bmesh.update_edit_mesh(head.data,loop_triangles=True,destructive=True);bpy.ops.object.mode_set(mode='OBJECT')
inverse=head.matrix_world.inverted()
headBias=[v.value for v in head.data.attributes['RigHeadWeight'].data]
basis=head.data.shape_keys.key_blocks[0]
for v in head.data.vertices:
 rest=basis.data[v.index].co.copy();w=head.matrix_world@rest
 if w.z>=1.555:continue
 weight=max(0,min(1,(1.555-w.z)/.07));weight=weight*weight*(3-2*weight)
 weight*=1-headBias[v.index]
 target=w.copy();target.y+=.045*weight
 target.x=target.x*(1-weight)+max(-.048,min(.048,target.x))*weight
 delta=inverse@target-rest
 for key in head.data.shape_keys.key_blocks:key.data[v.index].co+=delta
# Blend the replacement neck's albedo into the retained neck, without projecting
# shirt pixels onto skin. Geometry and every expression remain independently editable.
print('Matching neck material',flush=True)
body.data.calc_loop_triangles();triangles=[];triangleUV=[];skinSamples=[]
worldMatrix=body.matrix_world.copy();bodyWorld=[worldMatrix@v.co for v in body.data.vertices]
for triangle in body.data.loop_triangles:
 points=[bodyWorld[i] for i in triangle.vertices];center=sum(points,Vector())/3
 if not (1.43<center.z<1.515 and center.y<.02 and abs(center.x)<.04):continue
 coords=[uv.data[i].uv.copy() for i in triangle.loops];sample=sum(coords,Vector((0,0)))/3;r,g,b=pixels[min(image.size[1]-1,int(sample.y*image.size[1])),min(image.size[0]-1,int(sample.x*image.size[0])),:3]
 if r>g*1.08 and g>b*1.04 and .15<r<.9:triangles.append(points);triangleUV.append(coords);skinSamples.append((r,g,b))
if not triangles:raise ValueError('No retained neck skin for material seam matching')
print('Matched',len(triangles),'neck skin triangles',flush=True)
skinMedian=np.median(skinSamples,axis=0)
tree=BVHTree.FromPolygons([p for triangle in triangles for p in triangle],[(i*3,i*3+1,i*3+2) for i in range(len(triangles))],all_triangles=True)
for vertex in head.data.vertices:
 rest=basis.data[vertex.index].co.copy();point=head.matrix_world@rest
 if point.z>=1.505 or point.y>.035:continue
 hit,normal,index,distance=tree.find_nearest(point);weight=max(0,min(1,(1.505-point.z)/.025));weight=weight*weight*(3-2*weight)
 weight*=1-headBias[vertex.index]
 target=point.copy();target.y+=(hit.y+(-.0007 if point.z>=1.44 else .002)-point.y)*weight;delta=head.matrix_world.inverted()@target-rest
 for block in head.data.shape_keys.key_blocks:block.data[vertex.index].co+=delta
binding=np.array([[v.value for v in head.data.attributes[name].data] for name in ['RigHeadWeight','RigNeckWeight','RigChestWeight']]).T
head.vertex_groups.clear();groups=[head.vertex_groups.new(name=name) for name in ['Head','neck','Spine02']]
for index,weights in enumerate(binding):
 total=sum(weights)
 if total<.99:raise ValueError('Anatomical skin weights lost during topology refinement')
 # Adapt the authored three-bone neck blend to this single-neck body rig.
 h=max(0,min(1,(weights[0]/total-.10)/.80));h=h*h*(3-2*h);remaining=weights[1]+weights[2]
 weights=np.array([h,(1-h)*weights[1]/remaining if remaining>1e-8 else 0,(1-h)*weights[2]/remaining if remaining>1e-8 else 0]);total=sum(weights)
 for group,weight in zip(groups,weights):
  if weight>1e-6:group.add([index],float(weight/total),'REPLACE')
gameBefore=np.array([d.uv[:] for d in head.data.uv_layers['GameUV'].data])
head.data.color_attributes.new(name='NeckBlend',type='FLOAT_COLOR',domain='CORNER');head.data.color_attributes.new(name='NeckColor',type='FLOAT_COLOR',domain='CORNER')
blend=head.data.color_attributes['NeckBlend'];neckColor=head.data.color_attributes['NeckColor']
matrix=head.matrix_world.copy()
for loop in head.data.loops:
 point=matrix@basis.data[loop.vertex_index].co;weight=max(0,min(1,(1.56-point.z)/.045));weight=weight*weight*(3-2*weight)
 # Albedo transitions by surface height independently of skeletal stiffness.
 # Head weighting must not leave a dark horizontal ring above the old neck.
 lateral=max(0,min(1,(.085-abs(point.x))/.025));weight*=lateral*lateral*(3-2*lateral)
 if weight:
  hit,normal,index,distance=tree.find_nearest(point);a,b,c=triangles[index];u,v,w=[Vector((p.x,p.y,0)) for p in triangleUV[index]];mapped=barycentric_transform(hit,a,b,c,u,v,w)
  color=pixels[max(0,min(image.size[1]-1,int(mapped.y*image.size[1]))),max(0,min(image.size[0]-1,int(mapped.x*image.size[0]))),:3]
  r,g,b=color
  if not (g*1.08<r<g*1.8 and g>b*1.04 and .15<r<.9):color=skinMedian
  neckColor.data[loop.index].color=(*[float(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4) for c in color],1)
 blend.data[loop.index].color=(weight,weight,weight,1)
if not np.array_equal(gameBefore,np.array([d.uv[:] for d in head.data.uv_layers['GameUV'].data])):raise ValueError('Neck setup changed source GameUV')
material=head.data.materials[0];nodes=material.node_tree.nodes;links=material.node_tree.links;bsdf=nodes.get('Principled BSDF');original=bsdf.inputs['Base Color'].links[0].from_socket
neckAttribute=nodes.new('ShaderNodeVertexColor');neckAttribute.layer_name='NeckColor';attribute=nodes.new('ShaderNodeVertexColor');attribute.layer_name='NeckBlend';mix=nodes.new('ShaderNodeMixRGB');links.new(attribute.outputs['Color'],mix.inputs[0]);links.new(original,mix.inputs[1]);links.new(neckAttribute.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],bsdf.inputs['Base Color'])
gameUV=head.data.uv_layers['GameUV'];head.data.uv_layers.active=gameUV;gameUV.active_render=True
target=bpy.data.images.new('Astrid_Neck_Matched_BaseColor',width=3072,height=3072,alpha=True);target.filepath_raw=str(DEST/'astrid-face-basecolor.png');target.file_format='PNG';target.colorspace_settings.name='sRGB';bake=nodes.new('ShaderNodeTexImage');bake.image=target;nodes.active=bake
output=nodes.get('Material Output');surface=output.inputs['Surface'].links[0].from_socket;emission=nodes.new('ShaderNodeEmission');links.new(mix.outputs[0],emission.inputs['Color']);links.new(emission.outputs[0],output.inputs['Surface']);scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.threads_mode='FIXED';scene.render.threads=4
bpy.ops.object.select_all(action='DESELECT');head.select_set(True);bpy.context.view_layer.objects.active=head;bpy.ops.object.bake(type='EMIT',margin=16,use_clear=True);target.save();target.pack();links.new(surface,output.inputs['Surface']);links.new(bake.outputs['Color'],bsdf.inputs['Base Color']);bakeUV=nodes.new('ShaderNodeUVMap');bakeUV.uv_map='GameUV';links.new(bakeUV.outputs[0],bake.inputs[0])
bpy.data.objects.remove(facearm,do_unlink=True);bpy.context.view_layer.update()
scene['face_status']='Anatomical identity candidate: morph controls and gaze. Review in actual game before default promotion.'
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
 if o.type in ['MESH','ARMATURE']:o.hide_set(False);o.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(DEST/'astrid-rigged.blend'))
bpy.ops.export_scene.gltf(filepath=str(DEST/'astrid-rigged.glb'),export_format='GLB',use_selection=True,export_animations=False,export_morph=True,export_morph_normal=True,export_skins=True,export_materials='EXPORT')
set_material_factor(DEST/'astrid-rigged.glb','Eyes_Blue',[1,1,1,1])
profile=json.loads((ROOT/'assets/astrid-3d/profile.json').read_text());profile['version']=2;profile['vertices']=sum(len(o.data.vertices) for o in scene.objects if o.type=='MESH');profile['polygons']=sum(len(o.data.polygons) for o in scene.objects if o.type=='MESH');profile['face']={'gazeBones':['EyeLeft','EyeRight'],'shapes':[b.name for b in head.data.shape_keys.key_blocks][1:],'status':'rendered integration pending'};profile['limitations']=['Facial identity and source-driven speech require final visual review.','Body rig retains its earlier contact checks; face/neck integration is a new candidate.'];(DEST/'profile.json').write_text(json.dumps(profile,indent=2));(DEST/'attachment-verification.json').write_text(json.dumps({'retainedBodyVertices':len(body.data.vertices),'retainedBodyWeightMismatches':retainedMismatch,'faceVertices':len(head.data.vertices),'faceShapeVertexCounts':{b.name:len(b.data) for b in head.data.shape_keys.key_blocks},'bones':len(arm.data.bones),'headTranslationZ':-.05,'status':'staged; native/rendered checks required'},indent=2));print('Combined candidate saved')
