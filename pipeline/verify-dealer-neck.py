"""Check the evaluated anatomical neck against the retained body surface.

This catches using stale Mesh coordinates after editing facial shape-key Basis,
which previously left the lower neck almost five centimetres behind the body.
"""
import bpy, json, sys
from pathlib import Path
from mathutils.bvhtree import BVHTree

folder = Path(sys.argv[1]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(folder / 'astrid-rigged.blend'))
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
body = bpy.data.objects['char1'].evaluated_get(depsgraph)
head = bpy.data.objects['Astrid_Face'].evaluated_get(depsgraph)
body.data.calc_loop_triangles()
surface = BVHTree.FromPolygons([body.matrix_world @ v.co for v in body.data.vertices], [list(t.vertices) for t in body.data.loop_triangles], all_triangles=True)
distances = []
head_group = head.vertex_groups['Head'].index
for vertex in head.data.vertices:
    point = head.matrix_world @ vertex.co
    if not (1.445 < point.z < 1.47 and abs(point.x) < .025 and point.y < .04): continue
    if sum(g.weight for g in vertex.groups if g.group == head_group) > .005: continue
    distances.append(surface.find_nearest(point)[3] * 1000)
if len(distances) < 5: raise ValueError('Insufficient evaluated lower-neck surface samples')
report = {'samples': len(distances), 'maxSurfaceDistanceMm': max(distances), 'meanSurfaceDistanceMm': sum(distances)/len(distances), 'limitMm': 5, 'status': 'mechanical surface check; rendered seam acceptance remains separate'}
(folder / 'neck-verification.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
if max(distances) > 5: raise ValueError('Evaluated neck is separated from the body surface')
