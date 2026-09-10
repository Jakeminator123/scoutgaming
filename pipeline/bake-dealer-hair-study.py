"""Bake an isolated groom's procedural materials into portable glTF textures."""
import bpy,json,sys,hashlib,struct,numpy as np
from pathlib import Path
from dealer_glb_materials import set_material_factor
source=Path(sys.argv[1]).resolve();folder=Path(sys.argv[2]).resolve();folder.mkdir(parents=True,exist_ok=True);bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.preferences.filepaths.save_version=0;scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=4;scene.render.threads_mode='FIXED';scene.render.threads=4;scene.render.bake.margin=12;records=[]
for name,size in [('Astrid_Hair',2048),('Astrid_Hair_Bun_Core',512),('Astrid_Face',4096)]:
 obj=bpy.data.objects[name];bpy.ops.object.select_all(action='DESELECT');obj.hide_set(False);obj.select_set(True);bpy.context.view_layer.objects.active=obj
 uvName='GameUV' if name=='Astrid_Face' else 'HairGameUV'
 if name!='Astrid_Face':
  obj.data.uv_layers.new(name=uvName);obj.data.uv_layers.active_index=len(obj.data.uv_layers)-1;obj.data.uv_layers[uvName].active_render=True
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
 else:
  obj.data.uv_layers.active_index=list(obj.data.uv_layers.keys()).index(uvName);obj.data.uv_layers[uvName].active_render=True
 material=obj.data.materials[0];nodes=material.node_tree.nodes;links=material.node_tree.links;bsdf=nodes.get('Principled BSDF');output=nodes.get('Material Output');uv=nodes.new('ShaderNodeUVMap');uv.uv_map=uvName
 color=bpy.data.images.new(name+'_Portable_Color',width=size,height=size,alpha=True);color.colorspace_settings.name='sRGB';target=nodes.new('ShaderNodeTexImage');target.image=color;nodes.active=target
 emission=nodes.new('ShaderNodeEmission');links.new(bsdf.inputs['Base Color'].links[0].from_socket,emission.inputs['Color']);links.new(emission.outputs[0],output.inputs['Surface']);bpy.ops.object.bake(type='EMIT',use_clear=True);color.filepath_raw=str(folder/(name+'-color.png'));color.file_format='PNG';color.save();color.pack();links.new(bsdf.outputs[0],output.inputs['Surface']);nodes.remove(emission)
 if bsdf.inputs['Alpha'].is_linked:
  opacity=bpy.data.images.new(name+'_Portable_Opacity',width=size,height=size,alpha=False);opacity.colorspace_settings.name='Non-Color';opacityTarget=nodes.new('ShaderNodeTexImage');opacityTarget.image=opacity;nodes.active=opacityTarget
  alphaEmission=nodes.new('ShaderNodeEmission');links.new(bsdf.inputs['Alpha'].links[0].from_socket,alphaEmission.inputs['Color']);links.new(alphaEmission.outputs[0],output.inputs['Surface']);bpy.ops.object.bake(type='EMIT',use_clear=True)
  rgba=np.empty(size*size*4,dtype=np.float32);a=np.empty_like(rgba);color.pixels.foreach_get(rgba);opacity.pixels.foreach_get(a);rgba[3::4]=a[::4];color.pixels.foreach_set(rgba);color.update();color.save();color.pack();links.new(bsdf.outputs[0],output.inputs['Surface']);nodes.remove(alphaEmission);nodes.remove(opacityTarget);bpy.data.images.remove(opacity);links.new(target.outputs['Alpha'],bsdf.inputs['Alpha'])
 if name=='Astrid_Face':
  links.new(uv.outputs[0],target.inputs['Vector']);links.new(target.outputs['Color'],bsdf.inputs['Base Color']);records.append({'object':name,'size':size,'color':color.name,'normal':'unchanged'});continue
 normal=bpy.data.images.new(name+'_Portable_Normal',width=size,height=size,alpha=False);normal.colorspace_settings.name='Non-Color';normalTarget=nodes.new('ShaderNodeTexImage');normalTarget.image=normal;nodes.active=normalTarget;bpy.ops.object.bake(type='NORMAL',normal_space='TANGENT',use_clear=True);normal.filepath_raw=str(folder/(name+'-normal.png'));normal.file_format='PNG';normal.save();normal.pack()
 links.new(uv.outputs[0],target.inputs['Vector']);links.new(target.outputs['Color'],bsdf.inputs['Base Color']);links.new(uv.outputs[0],normalTarget.inputs['Vector']);normalMap=nodes.new('ShaderNodeNormalMap');normalMap.uv_map='HairGameUV';links.new(normalTarget.outputs['Color'],normalMap.inputs['Color']);links.new(normalMap.outputs[0],bsdf.inputs['Normal']);records.append({'object':name,'size':size,'color':color.name,'normal':normal.name})
bpy.ops.file.pack_all();blend=folder/'astrid-hair-game.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend),compress=True);bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
 if obj.type in {'MESH','ARMATURE'} and not obj.hide_render:obj.hide_set(False);obj.select_set(True)
# The masks have already been baked. Exporting them as COLOR_0 would tint the
# texture a second time in glTF. Keep masks in the saved editable .blend only.
for record in records:
 obj=bpy.data.objects[record['object']]
 record['removedExportColorAttributes']=[a.name for a in obj.data.color_attributes]
 for attributeName in list(obj.data.color_attributes.keys()):obj.data.color_attributes.remove(obj.data.color_attributes[attributeName])
glb=folder/'astrid-hair-game.glb';bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_animations=False,export_morph=True,export_morph_normal=True,export_skins=True,export_materials='EXPORT');set_material_factor(glb,'Eyes_Blue',[1,1,1,1])
data=glb.read_bytes();document=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]]);bindings=[{'name':m['name'],'primitives':[{'attributes':list(p['attributes']),'material':document['materials'][p['material']]['name']} for p in m['primitives']]} for m in document['meshes']]
report={'exportMeshBindings':bindings,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'blendSha256':hashlib.sha256(blend.read_bytes()).hexdigest(),'glbSha256':hashlib.sha256(glb.read_bytes()).hexdigest(),'textures':records,'status':'isolated portable material bake; native and browser comparison required'};(folder/'export-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
