"""Retain original lid triangles and author blink motion around independent eyes."""
def build_lids(spec,namespace):
    import bpy,math,numpy as np
    from mathutils import Vector
    world,triangles,uvs,normals,front,right,material,matrix,removed,face_region,sample,mesh_object,projected_material=[namespace[k] for k in ['world','triangles','uvs','normals','front','right','material','matrix','removed','face_region','sample','mesh_object','projected_material']]
    name=spec['name'];s,z,depth,R=[spec[k] for k in ['s','z','depth','radius']]
    def ease(x):x=min(1,max(0,x));return x*x*(3-2*x)
    def is_inside(p):
        dx=p.dot(right)-s;dz=p.z-z
        return (dx/.034)**2+(dz/(.016 if dz>=0 else .014))**2<1
    kept=[i for i in face_region[name] if not any(is_inside(world[v]) for v in triangles[i])]
    # Tiny retained slivers can meet at one vertex. Remove their incident
    # triangles until the opening has one manifold boundary, rather than
    # bridging across a four-way junction.
    canonical={};cut_canon={}
    for index in face_region[name]:
        for i in triangles[index]:
            k=tuple(round(float(v)/.000003) for v in world[i]);canonical.setdefault(k,i);cut_canon[i]=canonical[k]
    owners={}
    for index in face_region[name]:
        a=triangles[index]
        for x,y in zip(a,a[1:]+a[:1]):owners.setdefault(tuple(sorted((cut_canon[x],cut_canon[y]))),[]).append(index)
    for iteration in range(8):
        keep_set=set(kept);degrees={}
        for edge,incidents in owners.items():
            if any(i in keep_set for i in incidents) and any(i not in keep_set for i in incidents):
                for v in edge:degrees[v]=degrees.get(v,0)+1
        bad={v for v,d in degrees.items() if d>2}
        if not bad:break
        kept=[i for i in kept if not any(cut_canon[v] in bad for v in triangles[i])]
    ids=sorted(set(v for i in kept for v in triangles[i]));mapping={v:i for i,v in enumerate(ids)}
    vertices=[world[i].copy() for i in ids]
    faces=[[mapping[v] for v in triangles[i]] for i in kept]
    mesh=bpy.data.meshes.new('Original eyelid surface.'+name);mesh.from_pydata(vertices,[],faces);mesh.materials.append(material)
    uv=mesh.uv_layers.new(name='UVMap');normal_matrix=matrix.to_3x3().inverted().transposed();custom=[]
    for polygon,index in zip(mesh.polygons,kept):
        polygon.use_smooth=True
        for loop,value in zip(polygon.loop_indices,uvs[index]):uv.data[loop].uv=value
        custom.extend([(normal_matrix@n).normalized() for n in normals[index]])
    mesh.normals_split_custom_set(custom)
    obj=bpy.data.objects.new('Eyelids.'+name,mesh);bpy.context.collection.objects.link(obj)
    obj.shape_key_add(name='Basis');key=obj.shape_key_add(name='Blink')
    eye_centre=right*s+Vector((0,0,z))+front*(depth-R)
    def close_position(p):
        dx=p.dot(right)-s;dz=p.z-z
        if abs(dx)>=.034:return p.copy()
        inner=(.016 if dz>=0 else .014)*math.sqrt(max(0,1-(dx/.034)**2))
        outer=.038*math.sqrt(max(0,1-(dx/.052)**2))
        weight=ease((outer-abs(dz))/max(.002,outer-inner))
        closing_line=-.006*math.sqrt(max(0,1-(dx/.034)**2))
        closed_z=dz+(closing_line-math.copysign(inner,dz))*weight
        if abs(dz)<inner:closed_z=closing_line
        original_sphere=math.sqrt(max(0,R*R-dx*dx-dz*dz))
        closed_sphere=math.sqrt(max(0,R*R-dx*dx-closed_z*closed_z))
        moved=p.dot(front)+max(0,closed_sphere-original_sphere)
        forward=moved*(1-weight)+(depth-R+closed_sphere+.0015)*weight
        return right*(s+dx)+Vector((0,0,z+closed_z))+front*forward
    for v,p in zip(key.data,vertices):v.co=close_position(p)
    # Bridge the small irregular opening with a narrow lid margin. Most skin
    # remains the exact original geometry, UVs and imported corner normals.
    edge_owners={}
    canonical={};canon={}
    for i in ids:
        k=tuple(round(float(v)/.000003) for v in world[i]);canonical.setdefault(k,i);canon[i]=canonical[k]
    for index in face_region[name]:
        for i in triangles[index]:
            if i not in canon:
                k=tuple(round(float(v)/.000003) for v in world[i]);canonical.setdefault(k,i);canon[i]=canonical[k]
        a=triangles[index]
        for x,y in zip(a,a[1:]+a[:1]):edge_owners.setdefault(tuple(sorted((canon[x],canon[y]))),[]).append(index)
    keep_set=set(kept);edges=[edge for edge,owners in edge_owners.items() if any(i in keep_set for i in owners) and any(i not in keep_set for i in owners)]
    graph={}
    for a,b in edges:graph.setdefault(a,[]).append(b);graph.setdefault(b,[]).append(a)
    if any(len(v)!=2 for v in graph.values()):
        from collections import Counter
        print(name,'boundary degrees',Counter(len(v) for v in graph.values()),[(i,len(v),list(world[i])) for i,v in graph.items() if len(v)!=2],flush=True)
        raise RuntimeError('Eye opening boundary is not a ring')
    start=next(iter(graph));ring=[start];previous=None;current=start
    while True:
        nxt=next(i for i in graph[current] if i!=previous)
        if nxt==start:break
        if nxt in ring:raise RuntimeError('Eye opening has multiple loops')
        ring.append(nxt);previous,current=current,nxt
    angles=np.unwrap([math.atan2((world[i].z-z)/.015,(world[i].dot(right)-s)/.034) for i in ring])
    if angles[-1]<angles[0]:ring.reverse();angles=np.unwrap([math.atan2((world[i].z-z)/.015,(world[i].dot(right)-s)/.034) for i in ring])
    # The original boundary is jagged; regularize angles inside the new margin.
    angles=np.linspace(angles[0],angles[0]+math.pi*2,len(ring),endpoint=False)
    vertices=[];closed=[];tex=[];count=len(ring);rows=4
    for row in range(rows+1):
        t=row/rows
        for i,angle in zip(ring,angles):
            a=float(angle);dx=spec['innerW']*math.cos(a);dz=(spec['upperH'] if math.sin(a)>=0 else spec['lowerH'])*math.sin(a)
            inner=eye_centre+right*dx+Vector((0,0,dz))+front*(math.sqrt(max(.00001,R*R-dx*dx-dz*dz))+.0010)
            outer=world[i];pos=outer.lerp(inner,t)
            closing_line=-.006*abs(math.sin(a))
            shut=eye_centre+right*dx+Vector((0,0,closing_line))+front*(math.sqrt(max(.00001,R*R-dx*dx-closing_line**2))+.0015)
            vertices.append(pos);closed.append(close_position(outer).lerp(shut,t))
            uv_s=outer.dot(right)*(1-t)+(s+dx)*t
            skin_z=z+(.021 if math.sin(a)>=0 else -.019)*abs(math.sin(a))
            uv_z=outer.z*(1-t)+skin_z*t
            tex.append(((uv_s-s)/.13+.5,(uv_z-z)/.11+.5))
    faces=[]
    for row in range(rows):
        for j in range(count):
            k=(j+1)%count;a=row*count+j;b=row*count+k;c=(row+1)*count+k;d=(row+1)*count+j
            indices=[a,b,c,d]
            if (vertices[b]-vertices[a]).cross(vertices[d]-vertices[a]).dot(front)<0:indices.reverse()
            faces.append(indices)
    margin=mesh_object('LidMargin.'+name,vertices,faces,tex,projected_material(spec,'LidSkin',.13,.11))
    margin.shape_key_add(name='Basis');blink=margin.shape_key_add(name='Blink')
    for v,p in zip(blink.data,closed):v.co=p
    return eye_centre,len(ids)+len(vertices)
