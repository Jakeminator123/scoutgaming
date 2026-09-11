import bpy,json,os,sys
from pathlib import Path
from mathutils.kdtree import KDTree
base=Path(__file__).resolve().parent
version=sys.argv[1] if len(sys.argv)>1 else 'v1'
study=base/('finger-flexion-study' if version=='v1' else f'finger-flexion-study-{version}')
bpy.ops.wm.open_mainfile(filepath=str(study/'moderate-flexion.blend'))
m=max((o for o in bpy.data.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
e=m.evaluated_get(bpy.context.evaluated_depsgraph_get()); posed=e.to_mesh()
vs=m.data.vertices;pv=posed.vertices
weights=lambda i:{m.vertex_groups[g.group].name:round(g.weight,5) for g in vs[i].groups if g.weight>.0001}
rows=[]
for edge in m.data.edges:
 a,b=edge.vertices;rest=(vs[a].co-vs[b].co).length;length=(pv[a].co-pv[b].co).length
 if length-rest>.012:
  rows.append({'edge':[a,b],'restMm':rest*1000,'posedMm':length*1000,'weights':[weights(a),weights(b)],'positions':[list(vs[a].co),list(vs[b].co)]})
rows.sort(key=lambda r:r['posedMm']-r['restMm'],reverse=True)
kd=KDTree(len(vs))
for v in vs:kd.insert(v.co,v.index)
kd.balance();seams=[]
for v in vs:
 for co,j,d in kd.find_range(v.co,.000003):
  if j<=v.index:continue
  gap=(pv[v.index].co-pv[j].co).length
  if gap>.001:seams.append({'vertices':[v.index,j],'posedGapMm':gap*1000,'weights':[weights(v.index),weights(j)]})
seams.sort(key=lambda r:r['posedGapMm'],reverse=True)
result={'stretchedEdgeCount':len(rows),'worstEdges':rows[:16],'seamGapCount':len(seams),'worstSeams':seams[:12]}
(study/'weight-diagnostics.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result)[:13000],flush=True);os._exit(0)
