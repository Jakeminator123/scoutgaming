"""Fit the complete anatomical head and all expression targets to measured proportions."""
import bpy,json,numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'content/staging/2026-09-10/astrid-head-v2'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'astrid-face-base.blend'))
scene=bpy.context.scene;camera=bpy.data.objects.new('Identity_Camera',bpy.data.cameras.new('Identity_Camera'));scene.collection.objects.link(camera);camera.location=(0,-1,1.6);camera.rotation_euler=(Vector((0,0,1.6))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=85
scene.render.resolution_x=900;scene.render.resolution_y=1100;bpy.context.view_layer.update();projection=np.array(camera.calc_matrix_camera(bpy.context.evaluated_depsgraph_get(),x=900,y=1100))@np.array(camera.matrix_world.inverted());inverse=np.linalg.inv(projection)
fit=json.loads((OUT/'identity-fit.json').read_text());trans=np.array(fit['transforms']);tri=np.array(fit['triangles']);dest=np.array(fit['target']);worst=0

def warp(points):
 clip=np.column_stack((points,np.ones(len(points))))@projection.T;xy=np.column_stack(((clip[:,0]/clip[:,3]+1)*450,(1-clip[:,1]/clip[:,3])*550));mapped=xy.copy()
 for start in range(0,len(points),256):
  p=xy[start:start+256];delta=p[:,None,:]-trans[None,:,2,:];first=np.einsum('tij,btj->bti',trans[:,:2,:],delta);bary=np.concatenate((first,1-first.sum(2,keepdims=True)),axis=2);inside=(bary>=-1e-6).all(2);valid=inside.any(1);pick=inside.argmax(1);selected=bary[np.arange(len(p)),pick];q=np.einsum('bi,bij->bj',selected,dest[tri[pick]]);mapped[start:start+len(p)][valid]=q[valid]
 newclip=clip.copy();newclip[:,0]=(mapped[:,0]/450-1)*clip[:,3];newclip[:,1]=(1-mapped[:,1]/550)*clip[:,3];w=newclip@inverse.T;w=w[:,:3]/w[:,3,None]
 # The rear skull and low neckline keep their original shape.
 factor=np.clip((-points[:,1]-.005)/.065,0,1)*np.clip((points[:,2]-1.43)/.08,0,1);return points+(w-points)*factor[:,None]
for obj in [o for o in scene.objects if o.type=='MESH']:
 # Hair is fitted at its roots; skull/back silhouette remains stable.
 blocks=list(obj.data.shape_keys.key_blocks) if obj.data.shape_keys else []
 sources=[np.array([v.co[:] for v in b.data]) for b in blocks] if blocks else [np.array([v.co[:] for v in obj.data.vertices])]
 results=[warp(v) for v in sources];worst=max(worst,float(np.linalg.norm(results[0]-sources[0],axis=1).max()))
 if blocks:
  for block,result in zip(blocks,results):
   for v,p in zip(block.data,result):v.co=p
 for v,p in zip(obj.data.vertices,results[0]):v.co=p
 obj.data.update()
# Transparent eye shell must expose sclera/iris, not render the atlas's transparent pixels as black.
mat=bpy.data.materials['Eyes_Blue'];p=mat.node_tree.nodes.get('Principled BSDF');tex=next(n for n in mat.node_tree.nodes if n.type=='TEX_IMAGE');mat.node_tree.links.new(tex.outputs['Alpha'],p.inputs['Alpha']);mat.surface_render_method='DITHERED'
(OUT/'fit-verification.json').write_text(json.dumps({'maximumVertexDisplacementM':worst,'anatomicalObjects':[o.name for o in scene.objects if o.type=='MESH'],'status':'identity proportions fitted; render and expressions pending review'},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'astrid-face-fitted.blend'));print('Fitted; max vertex movement',worst)
