"""Create separate articulated eyes and surface-following eyelid rings on a copy."""
import bpy, numpy as np, math, json, os
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

OUT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(OUT.parent/'surface-repair/astrid-surface-repair.blend'))
face=next(o for o in bpy.data.objects if o.type=='MESH'); face.name='Astrid_Face'
data=face.data; matrix=face.matrix_world.copy()
world=[matrix@v.co for v in data.vertices]
triangles=[tuple(p.vertices) for p in data.polygons]
uvs=[[data.uv_layers.active.data[i].uv.copy() for i in p.loop_indices] for p in data.polygons]
normals=[[data.corner_normals[i].vector.copy() for i in p.loop_indices] for p in data.polygons]
material=data.materials[0]
tree=BVHTree.FromPolygons(world,triangles,all_triangles=True)
front=matrix.to_3x3()@Vector((1,0,0)); front.z=0;front.normalize()
right=Vector((-front.y,front.x,0));up=Vector((0,0,1))
lo=Vector([min(p[k] for p in world) for k in range(3)])
hi=Vector([max(p[k] for p in world) for k in range(3)])
centre=(lo+hi)/2; span=(hi.z-lo.z)*1.1
def from_pixel(x,y):return centre.dot(right)+(x/1000-.5)*span,centre.z+(.5-y/1000)*span
def sample(s,z):
    hit,normal,index,distance=tree.ray_cast(right*s+up*z+front, -front,2)
    if index is None:raise RuntimeError(f'No surface at {s},{z}')
    ids=triangles[index]
    tex=barycentric_transform(hit,*[world[i] for i in ids],*[Vector((v.x,v.y,0)) for v in uvs[index]])
    return hit,Vector((tex.x,tex.y))

specs=[]
for name,px,py in [('R',449,293),('L',594,293)]:
    s,z=from_pixel(px,py);point,uv=sample(s,z)
    specs.append({'name':name,'s':s,'z':z,'depth':point.dot(front),'radius':.0335,'outerW':.052,'outerH':.038,'innerW':.0305,'upperH':.011,'lowerH':.008})

# Cut the old eye detail from the face; preserve UVs and corner normals on every retained triangle.
removed={}; face_region={}
for index,ids in enumerate(triangles):
    p=sum((world[i] for i in ids),Vector())/3
    if p.dot(front)<.14:continue
    for spec in specs:
        q=((p.dot(right)-spec['s'])/spec['outerW'])**2+((p.z-spec['z'])/spec['outerH'])**2
        if q<1:removed[index]=spec['name'];face_region.setdefault(spec['name'],[]).append(index);break
kept=[i for i in range(len(triangles)) if i not in removed]
new=bpy.data.meshes.new('Astrid face with actual eye openings')
new.from_pydata([v.co[:] for v in data.vertices],[],[triangles[i] for i in kept]);new.materials.append(material)
layer=new.uv_layers.new(name='UVMap')
new_normals=[]
for polygon,index in zip(new.polygons,kept):
    polygon.use_smooth=True
    for loop,uv in zip(polygon.loop_indices,uvs[index]):layer.data[loop].uv=uv
    new_normals.extend(normals[index])
new.normals_split_custom_set(new_normals);face.data=new

canonical={};canon=[]
for i,p in enumerate(world):
    key=tuple(round(float(x)/.000003) for x in p)
    if key not in canonical:canonical[key]=i
    canon.append(canonical[key])
edge_owners={}
for index,ids in enumerate(triangles):
    if index not in removed and not any(((sum(world[v].z for v in ids)/3-spec['z'])/spec['outerH'])**2<2 for spec in specs):continue
    for a,b in zip(ids,ids[1:]+ids[:1]):
        edge=tuple(sorted((canon[a],canon[b])));edge_owners.setdefault(edge,[]).append(index)

def mesh_object(name,vertices,faces,texcoords,mat):
    m=bpy.data.meshes.new(name);m.from_pydata(vertices,[],faces);m.materials.append(mat)
    uv=m.uv_layers.new(name='UVMap')
    for p in m.polygons:
        p.use_smooth=True
        for loop in p.loop_indices:uv.data[loop].uv=texcoords[m.loops[loop].vertex_index]
    obj=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(obj);return obj

def plain_material(name,color,roughness):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value=color;p.inputs['Roughness'].default_value=roughness
    return m
sclera=plain_material('Eyes - warm sclera',(.54,.55,.52,1),.27)
iris_material=material.copy();iris_material.name='Eyes - original iris color'
p=iris_material.node_tree.nodes.get('Principled BSDF')
for socket in ['Normal','Metallic','Roughness']:
    for link in list(p.inputs[socket].links):iris_material.node_tree.links.remove(link)
p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=.23
cornea=plain_material('Eyes - cornea',(.95,.98,1,1),.035)
p=cornea.node_tree.nodes['Principled BSDF'];p.inputs['Transmission Weight'].default_value=1;p.inputs['IOR'].default_value=1.376

# Reproject the source color into continuous local UV charts. Interpolating the
# old atlas coordinates directly crosses its UV seams and tears the lid image.
color_node=next(n for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and any(l.to_socket.name=='Base Color' for l in n.outputs['Color'].links))
color_image=color_node.image;cw,ch=color_image.size
source_pixels=np.empty(cw*ch*4,dtype=np.float32);color_image.pixels.foreach_get(source_pixels);source_pixels=source_pixels.reshape(ch,cw,4)
def projected_material(spec,kind,width,height):
    size=384;pixels=np.empty((size,size,4),dtype=np.float32)
    for yy in range(size):
        z=spec['z']+((yy+.5)/size-.5)*height
        for xx in range(size):
            s=spec['s']+((xx+.5)/size-.5)*width
            hit,uv=sample(s,z)
            x=float(uv.x)%1*cw-.5;y=float(uv.y)%1*ch-.5
            ix=math.floor(x);iy=math.floor(y);fx=x-ix;fy=y-iy
            pixels[yy,xx]=(source_pixels[iy%ch,ix%cw]*(1-fx)*(1-fy)+source_pixels[iy%ch,(ix+1)%cw]*fx*(1-fy)+source_pixels[(iy+1)%ch,ix%cw]*(1-fx)*fy+source_pixels[(iy+1)%ch,(ix+1)%cw]*fx*fy)
    image=bpy.data.images.new(kind+'.'+spec['name'],width=size,height=size,alpha=True)
    image.colorspace_settings.name=color_image.colorspace_settings.name;image.pixels.foreach_set(pixels.ravel());image.pack()
    mat=plain_material(kind+'.'+spec['name'],(.5,.5,.5,1),.46 if kind=='LidSkin' else .24)
    node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
    mat.node_tree.links.new(node.outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    return mat

report=[]
for spec in specs:
    name=spec['name'];s,z,depth,R=[spec[k] for k in ['s','z','depth','radius']]
    boundary=[]
    for (a,b),owners in edge_owners.items():
        if any(removed.get(i)==name for i in owners) and any(i not in removed for i in owners):boundary.append((a,b))
    graph={}
    for a,b in boundary:graph.setdefault(a,[]).append(b);graph.setdefault(b,[]).append(a)
    if not graph or any(len(v)!=2 for v in graph.values()):raise RuntimeError(f'{name}: cut boundary is not a closed ring')
    start=next(iter(graph));ring=[start];previous=None;current=start
    while True:
        choices=[i for i in graph[current] if i!=previous];nxt=choices[0]
        if nxt==start:break
        if nxt in ring:raise RuntimeError('Boundary self-crossing')
        ring.append(nxt);previous,current=current,nxt
    if len(ring)!=len(graph):raise RuntimeError('Multiple cut boundaries')
    from dense_lids import build_lids
    eye_centre,lid_vertex_count=build_lids(spec,globals())
    iris_local_material=projected_material(spec,'IrisColor',.026,.026)
    count=len(ring)
    # A proper eye rotation pivot with a complete scleral globe.
    pivot=bpy.data.objects.new('EyePivot.'+name,None);bpy.context.collection.objects.link(pivot)
    pivot.location=eye_centre
    basis=__import__('mathutils').Matrix(((right.x,up.x,front.x),(right.y,up.y,front.y),(right.z,up.z,front.z)))
    pivot.rotation_euler=basis.to_euler();pivot.empty_display_type='PLAIN_AXES';pivot.empty_display_size=.025
    pivot['control_note']='Local X pitch / local Y yaw, initial review range +/- 10 degrees'
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=32,radius=R)
    globe=bpy.context.object;globe.name='Eyeball.'+name;globe.data.materials.append(sclera);globe.parent=pivot;globe.location=(0,0,0)
    for p in globe.data.polygons:p.use_smooth=True
    # Original photographic iris on a curved surface, moving with its globe.
    verts=[(0,0,R+.00016)];uv=[(.5,.5)];cap_faces=[];segments=64;radial=8;iris_radius=.014
    for row in range(1,radial+1):
        radius=iris_radius*row/radial
        for j in range(segments):
            angle=2*math.pi*j/segments;x=radius*math.cos(angle);y=radius*math.sin(angle)
            verts.append((x,y,math.sqrt(R*R-x*x-y*y)+.00016));uv.append((x/iris_radius*.5+.5,y/iris_radius*.5+.5))
    for j in range(segments):cap_faces.append((0,1+j,1+(j+1)%segments))
    for row in range(radial-1):
        for j in range(segments):cap_faces.append((1+row*segments+j,1+(row+1)*segments+j,1+(row+1)*segments+(j+1)%segments,1+row*segments+(j+1)%segments))
    iris=mesh_object('Iris.'+name,verts,cap_faces,uv,iris_local_material);iris.parent=pivot;iris.location=(0,0,0)
    # Transparent corneal dome, separate editable geometry.
    dome_verts=[(x,y,vz+.00012+.00065*max(0,1-(x*x+y*y)/iris_radius**2)**2) for x,y,vz in verts]
    dome=mesh_object('Cornea.'+name,dome_verts,cap_faces,uv,cornea);dome.parent=pivot;dome.location=(0,0,0)
    report.append({**spec,'boundaryVertices':count,'removedTriangles':len(face_region[name]),'lidVertices':lid_vertex_count,'eyeCentre':list(eye_centre)})

bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'astrid-eyes.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'astrid-eyes.glb'),export_format='GLB',export_image_format='AUTO',export_morph=True)
(OUT/'build.json').write_text(json.dumps({'status':'Candidate awaiting visual review','eyes':report},indent=2))
print('Saved editable eye candidate',flush=True);os._exit(0)
