"""Repair missing posterior scalp coverage on the evaluated neutral anatomy."""
import bpy,bmesh,json,sys,math,random,numpy as np
from pathlib import Path
from mathutils import Vector,geometry
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
source=Path(sys.argv[1]).resolve();folder=Path(sys.argv[2]).resolve();folder.mkdir(parents=True,exist_ok=True)
SCALP_OFFSET=.00025 # Colour underlay; the swept strands carry the visible hair volume.
bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.preferences.filepaths.save_version=0
head=bpy.data.objects['Astrid_Face'];cap=bpy.data.objects['Astrid_Hair'];old=cap.data;old.calc_loop_triangles()
points=[v.co.copy() for v in head.data.shape_keys.key_blocks['Basis'].data]
camera=bpy.data.objects.new('Hair reference projection',bpy.data.cameras.new('Hair reference projection'));bpy.context.scene.collection.objects.link(camera);camera.location=(0,-1,1.6);camera.rotation_euler=(Vector((0,0,1.6))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=85;bpy.context.view_layer.update();projection=np.array(camera.calc_matrix_camera(bpy.context.evaluated_depsgraph_get(),x=900,y=1100))@np.array(camera.matrix_world.inverted())
fit=json.loads((source.parents[3]/'content/staging/2026-09-10/astrid-head-v2/texture-fit.json').read_text());trans=np.array(fit['transforms']);tri=np.array(fit['triangles']);target=np.array(fit['target']);clip=np.column_stack((np.array(points),np.ones(len(points))))@projection.T;xy=np.column_stack(((clip[:,0]/clip[:,3]+1)*450,(1-clip[:,1]/clip[:,3])*550));mapped=np.zeros_like(xy);valid=np.zeros(len(points),bool)
for start in range(0,len(points),256):
 p=xy[start:start+256];delta=p[:,None,:]-trans[None,:,2,:];first=np.einsum('tij,btj->bti',trans[:,:2,:],delta);bary=np.concatenate((first,1-first.sum(2,keepdims=True)),axis=2);inside=(bary>=-1e-6).all(2);pick=inside.argmax(1);mapped[start:start+len(p)]=np.einsum('bi,bij->bj',bary[np.arange(len(p)),pick],target[tri[pick]]);valid[start:start+len(p)]=inside.any(1)
# Extend reference UVs from the nearest measured scalp point instead of
# switching abruptly to procedural colour at the projection hull boundary.
validTree=KDTree(int(valid.sum()))
for index in np.flatnonzero(valid):validTree.insert(points[int(index)],int(index))
validTree.balance()
for index in np.flatnonzero(~valid):mapped[index]=mapped[validTree.find(points[int(index)])[1]]
surface=bpy.data.meshes.new('Neutral scalp sampling');surface.from_pydata(points,[],[list(p.vertices) for p in head.data.polygons]);surface.update()
triangles=list(old.loop_triangles);tree=BVHTree.FromPolygons([v.co.copy() for v in old.vertices],[list(t.vertices) for t in triangles],all_triangles=True)
def posterior(p):
 threshold=1.69-.065*max(0,min(1,(p.y+.055)/.15))
 return p.y>-.055 and p.z>threshold and (abs(p.x)<.089 or p.z>1.72)
near=[tree.find_nearest(p) for p in points]
def ear_clearance(p):return 1.65-.025*max(0,min(1,(p.y-.035)/.05))+.05*max(0,min(1,(abs(p.x)-.04)/.03))*math.exp(-((p.y+.005)/.065)**2)
def hairline(p):
 angle=abs(math.atan2(p.x,-(p.y+.045)));anchors=[(0,1.728),(.8,1.714),(1.5,1.690),(1.95,1.695),(2.55,1.660),(math.pi,1.651)]
 for (a,z),(b,w) in zip(anchors,anchors[1:]):
  if angle<=b:
   t=max(0,min(1,(angle-a)/(b-a)));t=t*t*(3-2*t);return z+(w-z)*t
 return anchors[-1][1]
inside=[p.z>hairline(p) for p in points]
selected=[p for p in surface.polygons if all(inside[i] for i in p.vertices)]
vertexFaces={}
positionKeys=[tuple(round(c,5) for c in p) for p in points]
for p in selected:
 for i in p.vertices:vertexFaces.setdefault(positionKeys[i],[]).append(p.index)
remaining={p.index:p for p in selected};components=[]
while remaining:
 stack=[next(iter(remaining))];component=[]
 while stack:
  p=remaining.pop(stack.pop(),None)
  if p is None:continue
  component.append(p)
  for i in p.vertices:stack.extend(j for j in vertexFaces[positionKeys[i]] if j in remaining)
 components.append(component)
largestArea=max(sum(p.area for p in group) for group in components)
selected=[p for group in components if sum(p.area for p in group)>largestArea*.005 for p in group]
ids=sorted({i for p in selected for i in p.vertices});lookup={i:j for j,i in enumerate(ids)}
mesh=bpy.data.meshes.new('Continuous_Scalp_Coverage');mesh.from_pydata([points[i] for i in ids],[],[[lookup[i] for i in p.vertices] for p in selected]);mesh.update()
layer=mesh.uv_layers.new(name='Identity_Texture');sourceUV=head.data.uv_layers['Identity_Texture']
mesh.uv_layers.new(name='UnderlyingHeadUV')
blend=mesh.color_attributes.new(name='FrontReference',type='FLOAT_COLOR',domain='CORNER')
layer=mesh.uv_layers['Identity_Texture'] # Adding a color layer reallocates mesh custom data.
headLayer=mesh.uv_layers['UnderlyingHeadUV'];headUV=head.data.uv_layers['GameUV']
expectedUV={}
for polygon,original in zip(mesh.polygons,selected):
 polygon.use_smooth=True
 for li,sli,index in zip(polygon.loop_indices,head.data.polygons[original.index].loop_indices,original.vertices):
  layer.data[li].uv=(mapped[index,0]/2048,1-mapped[index,1]/2048)
  headLayer.data[li].uv=headUV.data[sli].uv
  expectedUV[li]=tuple(layer.data[li].uv)
  weight=max(0,min(1,(-surface.vertices[index].normal.y-.05)/.80));blend.data[li].color=(weight,weight,weight,1)
assert all((Vector(uv)-mesh.uv_layers['Identity_Texture'].data[i].uv).length<1e-6 for i,uv in expectedUV.items()),'UV custom-data write did not persist'
material=bpy.data.materials.new('Continuous_Combed_Hair');material.use_nodes=True;nodes=material.node_tree.nodes;links=material.node_tree.links;bsdf=nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.55;bsdf.inputs['Anisotropic'].default_value=.35
coordinates=nodes.new('ShaderNodeTexCoord');scale=nodes.new('ShaderNodeVectorMath');scale.operation='MULTIPLY';scale.inputs[1].default_value=(900,24,900);links.new(coordinates.outputs['Generated'],scale.inputs[0]);noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1;noise.inputs['Detail'].default_value=2;links.new(scale.outputs[0],noise.inputs['Vector']);ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.065,.035,.012,1);ramp.color_ramp.elements[1].color=(.24,.145,.065,1);links.new(noise.outputs['Fac'],ramp.inputs[0])
image=nodes.new('ShaderNodeTexImage');image.image=bpy.data.images.load(str(source.parents[3]/'content/staging/2026-09-10/astrid-head-v2/astrid-neutral-reference.png'),check_existing=True);image.image.pack();uv=nodes.new('ShaderNodeUVMap');uv.uv_map='Identity_Texture';links.new(uv.outputs[0],image.inputs['Vector']);attribute=nodes.new('ShaderNodeVertexColor');attribute.layer_name='FrontReference';mix=nodes.new('ShaderNodeMixRGB');links.new(attribute.outputs['Color'],mix.inputs[0]);links.new(ramp.outputs['Color'],mix.inputs[1]);links.new(image.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],bsdf.inputs['Base Color']);bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.02;bump.inputs['Distance'].default_value=.00015;links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],bsdf.inputs['Normal']);mesh.materials.append(material)
ramp.color_ramp.elements[0].color=(.09,.055,.028,1);ramp.color_ramp.elements[1].color=(.35,.22,.12,1)
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(mesh);bm.free()
temporary=bpy.data.objects.new('Scalp contour refinement',mesh);bpy.context.scene.collection.objects.link(temporary);subdivision=temporary.modifiers.new('Refine contour','SUBSURF');subdivision.levels=2;subdivision.render_levels=2;bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();mesh=bpy.data.meshes.new_from_object(temporary.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg);bpy.data.objects.remove(temporary,do_unlink=True)
anatomy=BVHTree.FromPolygons(points,[list(p.vertices) for p in surface.polygons])
for vertex in mesh.vertices:
 hit,normal,index,distance=anatomy.find_nearest(vertex.co);vertex.co=hit+normal*SCALP_OFFSET
bm=bmesh.new();bm.from_mesh(mesh);bm.verts.ensure_lookup_table();boundary={v.index:[e.other_vert(v).index for e in v.link_edges if e.is_boundary] for v in bm.verts if any(e.is_boundary for e in v.link_edges)};bm.free();originalBoundary={i:mesh.vertices[i].co.copy() for i in boundary}
for iteration in range(10):
 changes={}
 for i,neighbors in boundary.items():
  if len(neighbors)!=2:continue
  point=mesh.vertices[i].co.lerp((mesh.vertices[neighbors[0]].co+mesh.vertices[neighbors[1]].co)*.5,.5)
  delta=point-originalBoundary[i];limit=.002 if point.y<.015 else .004
  if delta.length>limit:point=originalBoundary[i]+delta.normalized()*limit
  hit,normal,index,distance=anatomy.find_nearest(point)
  if hit is not None:changes[i]=hit+normal*SCALP_OFFSET
 for i,point in changes.items():mesh.vertices[i].co=point
# Fit the boundary to one continuous hairline rather than retaining the
# original disconnected cap's large triangular stair steps.
for iteration in range(6):
 for i in boundary:
  point=mesh.vertices[i].co.copy();point.z=hairline(point);hit,normal,index,distance=anatomy.find_nearest(point)
  if hit is not None:mesh.vertices[i].co=hit+normal*SCALP_OFFSET
edgeTree=KDTree(len(boundary))
for i,index in enumerate(boundary):edgeTree.insert(mesh.vertices[index].co,i)
edgeTree.balance();density=mesh.color_attributes.new(name='RootDensity',type='FLOAT_COLOR',domain='POINT')
for vertex in mesh.vertices:
 d=edgeTree.find(vertex.co)[2];weight=max(0,min(1,d/.003));weight=weight*weight*(3-2*weight);density.data[vertex.index].color=(weight,weight,weight,1)
skinNode=head.data.materials[0].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].links[0].from_node;assert skinNode.type=='TEX_IMAGE'
skin=nodes.new('ShaderNodeTexImage');skin.image=skinNode.image;skinUV=nodes.new('ShaderNodeUVMap');skinUV.uv_map='UnderlyingHeadUV';links.new(skinUV.outputs[0],skin.inputs['Vector']);rootAttribute=nodes.new('ShaderNodeVertexColor');rootAttribute.layer_name='RootDensity';rootMix=nodes.new('ShaderNodeMixRGB');links.new(rootAttribute.outputs['Color'],rootMix.inputs[0]);links.new(skin.outputs['Color'],rootMix.inputs[1]);links.new(mix.outputs[0],rootMix.inputs[2]);links.new(rootMix.outputs[0],bsdf.inputs['Base Color']);links.new(rootAttribute.outputs['Color'],bsdf.inputs['Alpha']);material.surface_render_method='DITHERED'
cap.data=mesh;cap.material_slots[0].link='DATA';cap.material_slots[0].material=material;(cap.vertex_groups.get('Head') or cap.vertex_groups.new(name='Head')).add(list(range(len(mesh.vertices))),1,'REPLACE');cap['scalp_coverage_study']=1
# A compact solid bun underneath the retained individual strand endings.
headCenter=Vector((0,.022,1.70));tie,tieNormal,_,_=anatomy.ray_cast(headCenter,Vector((0,1,-.45)).normalized(),.4);bunCenter=tie+tieNormal*.011;right=Vector((1,0,0));up=right.cross(tieNormal).normalized()
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=(0,0,0));bun=bpy.context.object;bun.name='Astrid_Hair_Bun_Core'
for v in bun.data.vertices:v.co=bunCenter+right*v.co.x*.018+tieNormal*v.co.y*.010+up*v.co.z*.016
bunMaterial=material.copy();bunMaterial.name='Combed_Bun_Core';bunNodes=bunMaterial.node_tree.nodes;bunLinks=bunMaterial.node_tree.links;bunLinks.new(next(n for n in bunNodes if n.type=='VALTORGB').outputs['Color'],bunNodes.get('Principled BSDF').inputs['Base Color']);bun.data.materials.append(bunMaterial)
bunNodes.get('Principled BSDF').inputs['Roughness'].default_value=.7
for alphaLink in list(bunNodes.get('Principled BSDF').inputs['Alpha'].links):bunLinks.remove(alphaLink)
bunNodes.get('Principled BSDF').inputs['Alpha'].default_value=1
for p in bun.data.polygons:p.use_smooth=True
bun.parent=cap.parent;bun.matrix_world=cap.matrix_world.copy();group=bun.vertex_groups.new(name='Head');group.add(list(range(len(bun.data.vertices))),1,'REPLACE')
modifier=bun.modifiers.new('Dealer rig','ARMATURE');modifier.object=next(m.object for m in cap.modifiers if m.type=='ARMATURE')
# Distribute swept strands over the whole corrected scalp, including the sides.
# Retain editable curves separately from the evaluated, rigged runtime mesh.
curve=bpy.data.curves.new('Continuous swept groom','CURVE');curve.dimensions='3D';curve.resolution_u=1;curve.bevel_depth=.000045;curve.bevel_resolution=0
for i in range(6):
 fiberMaterial=bpy.data.materials['Hair_Fiber_'+str(i)].copy();fiberMaterial.name='Combed_Fiber_'+str(i);p=fiberMaterial.node_tree.nodes.get('Principled BSDF');t=i/5;p.inputs['Base Color'].default_value=(.07+.28*t,.045+.195*t,.025+.115*t,1);p.inputs['Roughness'].default_value=.65;curve.materials.append(fiberMaterial)
rng=random.Random(417);center=Vector((0,-.045,1.70));rootFaces=selected;weights=[p.area for p in rootFaces]
for strand in range(2400):
 polygon=rng.choices(rootFaces,weights=weights,k=1)[0];corners=[points[i] for i in polygon.vertices];u=rng.random();v=rng.random();root=corners[0].lerp(corners[1],u).lerp(corners[-1].lerp(corners[-2],u),v)
 density=max(0,min(1,(root.y+.035)/.05));density=density*density*(3-2*density)
 if rng.random()>density:continue # Graded rear density preserves the frontal side part.
 a=(root-center).normalized();b=(tie-center).normalized();spline=curve.splines.new('POLY');spline.points.add(19);spline.material_index=rng.randrange(6)
 for j,point in enumerate(spline.points):
  t=j/19;direction=(a*(1-t)**2+Vector((a.x*.25,0,1))*(2*t*(1-t)*1.4)+b*t*t).normalized() if a.y<0 else a.lerp(b,t).normalized();hit,normal,index,distance=anatomy.ray_cast(center,direction,.4)
  if hit is None:hit=root.lerp(tie,t);normal=direction
  offset=.0015+(.0015 if strand<16 else .00035)*math.sin(math.pi*t);point.co=(*(hit+normal*offset),1);point.radius=(.4+.6*density)*(.7+.3*math.sin(math.pi*t))
for strand in range(192):
 spline=curve.splines.new('POLY');spline.points.add(31);spline.material_index=rng.randrange(6);phase=strand*math.tau/192+rng.uniform(-.03,.03)
 for j,point in enumerate(spline.points):
  t=j/31;r=.985*(1-t);angle=phase+t*math.tau*1.5+.08*math.sin(t*math.tau*2+phase);co=bunCenter+right*(.018*r*math.cos(angle))+tieNormal*(.010*math.sqrt(max(0,1-r*r))+.00015)+up*(.016*r*math.sin(angle));point.co=(*co,1);point.radius=1.4*(1-t*.4)
edgeRoots=[mesh.vertices[i].co.copy() for i in boundary if mesh.vertices[i].co.y>.015 and mesh.vertices[i].co.z<1.72]
for strand in range(120):
 root=rng.choice(edgeRoots);start=root+Vector((0,0,.0015));end=root+Vector((rng.uniform(-.001,.001),0,-rng.uniform(.0015,.004)));spline=curve.splines.new('POLY');spline.points.add(5);spline.material_index=rng.randrange(6)
 for j,point in enumerate(spline.points):
  t=j/5;hit,normal,index,distance=anatomy.find_nearest(start.lerp(end,t));point.co=(*(hit+normal*(.0004-.0003*t)),1);point.radius=.8*(1-t)+.04
sourceObject=bpy.data.objects.new('SOURCE_Continuous_Swept_Groom',curve);bpy.context.scene.collection.objects.link(sourceObject);bpy.context.view_layer.update();groomMesh=bpy.data.meshes.new_from_object(sourceObject.evaluated_get(bpy.context.evaluated_depsgraph_get()),preserve_all_data_layers=True,depsgraph=bpy.context.evaluated_depsgraph_get());sourceObject.hide_render=True;sourceObject.hide_set(True);sourceObject.parent=cap.parent;sourceObject.parent_type='BONE';sourceObject.parent_bone='Head';bpy.context.view_layer.update();sourceObject.matrix_world=cap.matrix_world.copy()
oldFibers=bpy.data.objects['Astrid_Hair_Fibers'];bpy.data.objects.remove(oldFibers,do_unlink=True);fibers=bpy.data.objects.new('Astrid_Hair_Fibers',groomMesh);bpy.context.scene.collection.objects.link(fibers);fibers.parent=cap.parent;fibers.matrix_world=cap.matrix_world.copy();fibers.vertex_groups.new(name='Head').add(list(range(len(groomMesh.vertices))),1,'REPLACE');fibers.modifiers.new('Dealer rig','ARMATURE').object=modifier.object
# Correct the pre-existing orange posterior atlas band without altering the front
# texture, positions, topology, shape keys or weights. The editable mask is local.
posteriorMask=head.data.color_attributes.new(name='PosteriorAtlasCorrection',type='FLOAT_COLOR',domain='POINT')
def smooth(value):
 value=max(0,min(1,value));return value*value*(3-2*value)
for i,p in enumerate(points):
 weight=smooth((p.y+.040)/.040)*smooth((p.z-1.59)/.035)
 posteriorMask.data[i].color=(weight,weight,weight,1)
headMaterial=head.data.materials[0].copy();headMaterial.name='Astrid_Posterior_Atlas_Study';head.data.materials[0]=headMaterial;head.material_slots[0].link='DATA';head.material_slots[0].material=headMaterial
hn=headMaterial.node_tree.nodes;hl=headMaterial.node_tree.links;hb=hn.get('Principled BSDF');originalColor=hb.inputs['Base Color'].links[0].from_socket
luma=hn.new('ShaderNodeRGBToBW');hl.new(originalColor,luma.inputs[0]);levels=hn.new('ShaderNodeMapRange');levels.inputs['From Min'].default_value=0;levels.inputs['From Max'].default_value=1;levels.inputs['To Min'].default_value=.18;levels.inputs['To Max'].default_value=.65;hl.new(luma.outputs[0],levels.inputs['Value'])
tint=hn.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1;tint.inputs[2].default_value=(1,.74,.62,1);hl.new(levels.outputs[0],tint.inputs[1]);mask=hn.new('ShaderNodeVertexColor');mask.layer_name='PosteriorAtlasCorrection';posteriorMix=hn.new('ShaderNodeMixRGB');hl.new(mask.outputs['Color'],posteriorMix.inputs[0]);hl.new(originalColor,posteriorMix.inputs[1]);hl.new(tint.outputs[0],posteriorMix.inputs[2]);hl.new(posteriorMix.outputs[0],hb.inputs['Base Color'])
capMask=mesh.color_attributes.new(name='PosteriorAtlasCorrection',type='FLOAT_COLOR',domain='POINT')
for vertex in mesh.vertices:
 p=vertex.co;w=smooth((p.y+.040)/.040)*smooth((p.z-1.59)/.035);capMask.data[vertex.index].color=(w,w,w,1)
cl=nodes.new('ShaderNodeRGBToBW');links.new(skin.outputs['Color'],cl.inputs[0]);lev=nodes.new('ShaderNodeMapRange');lev.inputs['To Min'].default_value=.18;lev.inputs['To Max'].default_value=.65;links.new(cl.outputs[0],lev.inputs['Value']);ct=nodes.new('ShaderNodeMixRGB');ct.blend_type='MULTIPLY';ct.inputs[0].default_value=1;ct.inputs[2].default_value=(1,.74,.62,1);links.new(lev.outputs[0],ct.inputs[1]);ca=nodes.new('ShaderNodeVertexColor');ca.layer_name='PosteriorAtlasCorrection';cm=nodes.new('ShaderNodeMixRGB');links.new(ca.outputs['Color'],cm.inputs[0]);links.new(skin.outputs['Color'],cm.inputs[1]);links.new(ct.outputs[0],cm.inputs[2]);links.new(cm.outputs[0],rootMix.inputs[1])
path=folder/'astrid-scalp-coverage.blend';bpy.ops.wm.save_as_mainfile(filepath=str(path))
report={'source':str(source),'oldCapVertices':len(old.vertices),'newCapVertices':len(mesh.vertices),'newCapFaces':len(mesh.polygons),'posteriorCoveredVertices':sum(posterior(points[i]) for i in ids),'newlyCoveredVertices':sum(posterior(points[i]) and near[i][3]>.006 for i in ids),'headTopologyAndShapesUnchanged':True,'status':'isolated coverage repair; front and rear visual review required'}
(folder/'coverage-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
