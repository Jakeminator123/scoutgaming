import bpy, json, math
from pathlib import Path
from mathutils import Vector, Matrix
root=Path('/Users/solvifyab/Desktop/croupier/content/staging/2026-09-11/astrid-replacement')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'inspection/triangle-source/provider-original.glb'))
o=next(o for o in bpy.context.scene.objects if o.type=='MESH')
p=[o.matrix_world@v.co for v in o.data.vertices]
lo=Vector(tuple(min(v[i] for v in p) for i in range(3))); hi=Vector(tuple(max(v[i] for v in p) for i in range(3)))
centre=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z)); scale=1.73/(hi.z-lo.z)
rot=Matrix.Rotation(-math.pi/2,4,'Z')
p=[rot@((v-centre)*scale) for v in p]
hand=[{'i':i,'p':list(v)} for i,v in enumerate(p) if abs(v.x)>.28 and .72<v.z<1.08]
(root/'hand-study/points.json').write_text(json.dumps({'sourceBounds':[list(lo),list(hi)],'centre':list(centre),'scale':scale,'rotationZ':-math.pi/2,'points':hand}))
print(json.dumps({'bounds':[list(lo),list(hi)],'scale':scale,'hands':len(hand)}))
