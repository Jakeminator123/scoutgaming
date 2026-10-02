"""Texture the new anatomical head with a neutral-light full-face reference.
Keeps separate eyes, teeth and mouth geometry. Does not touch the live dealer.
"""
import bpy,json,numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'media/dealers/astrid/staging/2026-09-10/astrid-head-v2'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'astrid-face-fitted.blend'))
scene=bpy.context.scene;camera=bpy.data.objects['Identity_Camera'];bpy.context.view_layer.update();projection=np.array(camera.calc_matrix_camera(bpy.context.evaluated_depsgraph_get(),x=900,y=1100))@np.array(camera.matrix_world.inverted())
fit=json.loads((OUT/'texture-fit.json').read_text());trans=np.array(fit['transforms']);tri=np.array(fit['triangles']);target=np.array(fit['target']);reference=bpy.data.images.load(str(OUT/'astrid-neutral-reference.png'));reference.pack()
for name in ['Astrid_Face','Astrid_Hair']:
 obj=bpy.data.objects[name];mesh=obj.data;points=np.array([v.co[:] for v in mesh.vertices]);clip=np.column_stack((points,np.ones(len(points))))@projection.T;xy=np.column_stack(((clip[:,0]/clip[:,3]+1)*450,(1-clip[:,1]/clip[:,3])*550));mapped=np.zeros_like(xy);valid=np.zeros(len(points),bool)
 for start in range(0,len(points),256):
  p=xy[start:start+256];delta=p[:,None,:]-trans[None,:,2,:];first=np.einsum('tij,btj->bti',trans[:,:2,:],delta);bary=np.concatenate((first,1-first.sum(2,keepdims=True)),axis=2);inside=(bary>=-1e-6).all(2);ok=inside.any(1);pick=inside.argmax(1);weights=bary[np.arange(len(p)),pick];q=np.einsum('bi,bij->bj',weights,target[tri[pick]]);mapped[start:start+len(p)]=q;valid[start:start+len(p)]=ok
 uv=mesh.uv_layers.new(name='Identity_Texture');mask=mesh.color_attributes.new(name='Identity_Texture_Weight',type='FLOAT_COLOR',domain='CORNER');uv=mesh.uv_layers['Identity_Texture']
 norms=np.array([v.normal[:] for v in mesh.vertices]);weight=np.clip((-points[:,1]-.005)/.055,0,1)*np.clip((points[:,2]-1.44)/.08,0,1)*valid
 if name=='Astrid_Face':weight*=np.clip((-norms[:,1]+.25)/.65,0,1)
 for loop in mesh.loops:
  index=loop.vertex_index;uv.data[loop.index].uv=(mapped[index,0]/2048,1-mapped[index,1]/2048);w=weight[index];mask.data[loop.index].color=(w,w,w,1)
 mat=obj.data.materials[0];nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF');base=p.inputs['Base Color'].links[0].from_socket
 if name=='Astrid_Hair':
  ramp=next(n for n in nodes if n.type=='VALTORGB');ramp.color_ramp.elements[0].color=(.018,.009,.003,1);ramp.color_ramp.elements[1].position=.28;ramp.color_ramp.elements[1].color=(.38,.24,.095,1);p.inputs['Roughness'].default_value=.43;p.inputs['Anisotropic'].default_value=.35
 else:
  tint=nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1;tint.inputs[2].default_value=(.8,.69,.62,1);links.new(base,tint.inputs[1]);base=tint.outputs[0]
 tex=nodes.new('ShaderNodeTexImage');tex.image=reference;tex.extension='EXTEND';uvn=nodes.new('ShaderNodeUVMap');uvn.uv_map='Identity_Texture';links.new(uvn.outputs['UV'],tex.inputs['Vector']);attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='Identity_Texture_Weight';mix=nodes.new('ShaderNodeMixRGB');links.new(attr.outputs['Color'],mix.inputs[0]);links.new(base,mix.inputs[1]);links.new(tex.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],p.inputs['Base Color']);mesh.uv_layers.active_index=0
# The texture contains Astrid's own eyebrows; retain the optional mesh in the source but hide duplicate brows.
bpy.data.objects['Astrid_Eyebrows'].hide_render=True;bpy.data.objects['Astrid_Eyebrows'].hide_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'astrid-face-textured.blend'));print('Saved identity-textured anatomical head')
