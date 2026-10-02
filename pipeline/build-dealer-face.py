"""Build an editable, anatomically separated face candidate from CC0 MakeHuman assets.
Does not overwrite the game dealer. Identity fit and visual acceptance are separate.
"""
import bpy, json, sys
from pathlib import Path
from mathutils import Vector
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'media/dealers/astrid/staging/2026-09-10/astrid-head-v2'
DATA=OUT/'vendor/makehuman/makehuman/data'; SYS=OUT/'vendor/system'
bpy.ops.wm.read_factory_settings(use_empty=True)
def obj_data(path):
 v=[];uv=[];faces=[];groups=[];group=''
 for l in path.read_text().splitlines():
  a=l.split()
  if not a:continue
  if a[0]=='v':v.append(list(map(float,a[1:4])))
  elif a[0]=='vt':uv.append(list(map(float,a[1:3])))
  elif a[0]=='g':group=a[1]
  elif a[0]=='f':faces.append([(int(t.split('/')[0])-1,int(t.split('/')[1])-1 if '/' in t and t.split('/')[1] else 0) for t in a[1:]]);groups.append(group)
 return np.array(v),uv,faces,groups
raw,uv,faces,groups=obj_data(DATA/'3dobjs/base.obj')
def target(path):
 delta=np.zeros_like(raw)
 for l in path.read_text().splitlines():
  a=l.split()
  if a and a[0].isdigit():delta[int(a[0])]=list(map(float,a[1:4]))
 return delta
base=raw.copy()
for f in ['caucasian-female-young','universal-female-young-averagemuscle-averageweight']:base+=target(DATA/f'targets/macrodetails/{f}.target')
SCALE=.1; TOP=1.78; OFFSET=TOP-base[:,1].max()*SCALE
def world(v):return np.column_stack((v[:,0]*SCALE,-v[:,2]*SCALE,(v[:,1]*SCALE+OFFSET)))
expressions={p.stem:target(p) for p in (DATA/'targets/expression/units/caucasian').glob('*.target')}
names={'eye-left-closure':'eyeBlinkLeft','eye-right-closure':'eyeBlinkRight','mouth-open':'jawOpen','mouth-pursing':'mouthPucker','mouth-corner-puller':'mouthSmile','mouth-compression':'mouthClose','eyebrows-left-inner-up':'browInnerUpLeft','eyebrows-right-inner-up':'browInnerUpRight','mouth-part-later':'mouthWide','mouth-protusion':'mouthFunnel'}
def material(name,image=None,rough=.45,alpha=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;p=n.get('Principled BSDF');p.inputs['Roughness'].default_value=rough
 if image:
  tex=n.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(image),check_existing=True);tex.image.pack();m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
  if alpha:m.node_tree.links.new(tex.outputs['Alpha'],p.inputs['Alpha']);m.surface_render_method='DITHERED'
 else:p.inputs['Base Color'].default_value=(.20,.035,.028,1)
 if name=='Facial_Skin':
  p.inputs['Subsurface Weight'].default_value=.12;p.inputs['Subsurface Radius'].default_value=(1,.35,.15);p.inputs['Subsurface Scale'].default_value=.004
  noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1200;noise.inputs['Detail'].default_value=2
  bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.00012
  m.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
 return m
skin=material('Facial_Skin',SYS/'skins/young_caucasian_female/young_lightskinned_female_diffuse.png',.42)
def make(name,positions,uvs,facepairs,mat,shape_positions=None,subdiv=1):
 ids=sorted({v for f in facepairs for v,t in f});lookup={x:i for i,x in enumerate(ids)}
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(world(positions[ids]).tolist(),[],[[lookup[v] for v,t in f] for f in facepairs]);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
 layer=mesh.uv_layers.new(name='UVMap')
 for poly,f in zip(mesh.polygons,facepairs):
  poly.use_smooth=True
  for li,(_,ti) in zip(poly.loop_indices,f):layer.data[li].uv=uvs[ti]
 if shape_positions:
  o.shape_key_add(name='Basis')
  for key,points in shape_positions.items():
   block=o.shape_key_add(name=key);w=world(points[ids])
   for i,co in enumerate(w):block.data[i].co=co
 if subdiv:
  mod=o.modifiers.new('Facial_Surface','SUBSURF');mod.levels=subdiv;mod.render_levels=2
 return o,ids
headfaces=[f for f,g in zip(faces,groups) if g=='body' and min(base[v,1] for v,t in f)>4.85]
head,headids=make('Astrid_Face',base,uv,headfaces,skin,{names[k]:base+v for k,v in expressions.items() if k in names})
def proxy(name,folder,stem,mat,subdiv=1):
 orig,uvs,fs,gs=obj_data(folder/(stem+'.obj'));lines=(folder/(stem+'.mhclo')).read_text().splitlines();mapping=[];scales=np.ones(3);active=False
 for l in lines:
  a=l.split()
  if not a or a[0].startswith('#'):continue
  if a[0] in ['x_scale','y_scale','z_scale']:
   axis={'x_scale':0,'y_scale':1,'z_scale':2}[a[0]];scales[axis]=abs(base[int(a[1]),axis]-base[int(a[2]),axis])/float(a[3])
  if a[0]=='verts':active=True;continue
  if active:
   if not a[0].isdigit():
    if mapping:break
    continue
   if len(a)==1:mapping.append(([int(a[0])],[1],np.zeros(3)))
   else:mapping.append((list(map(int,a[:3])),list(map(float,a[3:6])),np.array(list(map(float,a[6:9])))))
 if len(mapping)!=len(orig):raise ValueError((name,len(mapping),len(orig)))
 def deform(b):return np.array([sum((b[i]*w for i,w in zip(ii,ww)),np.zeros(3))+off*scales for ii,ww,off in mapping])
 return make(name,deform(base),uvs,fs,mat,{names[k]:deform(base+v) for k,v in expressions.items() if k in names},subdiv)[0]
eyes=proxy('Astrid_Eyes',DATA/'eyes/high-poly','high-poly',material('Eyes_Blue',SYS/'eyes/materials/blue_eye.png',.22,True),1)
teeth=proxy('Astrid_Teeth',SYS/'teeth/teeth_base','teeth_base',material('Teeth',SYS/'teeth/teeth_base/teeth.png',.3),1)
tongue=proxy('Astrid_Tongue',SYS/'tongue/tongue01','tongue01',material('Tongue',SYS/'tongue/tongue01/tongue01_diffuse.png',.36),1)
lashes=proxy('Astrid_Eyelashes',SYS/'eyelashes/eyelashes01','eyelashes01',material('Lashes',SYS/'eyelashes/eyelashes01/eyelashes01.png',.55,True),1)
hairmat=material('Blonde_Hair',SYS/'hair/ponytail01/ponytail01_diffuse.png',.48,True)
n=hairmat.node_tree.nodes;links=hairmat.node_tree.links;p=n.get('Principled BSDF');tex=next(x for x in n if x.type=='TEX_IMAGE');bw=n.new('ShaderNodeRGBToBW');links.new(tex.outputs['Color'],bw.inputs[0]);ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.11,.065,.028,1);ramp.color_ramp.elements[1].color=(.62,.43,.22,1);links.new(bw.outputs[0],ramp.inputs[0]);links.new(ramp.outputs[0],p.inputs['Base Color'])
hair=proxy('Astrid_Hair',SYS/'hair/ponytail01','ponytail01',hairmat,1)
brows=proxy('Astrid_Eyebrows',SYS/'eyebrows/eyebrow005','eyebrow005',material('Eyebrows',SYS/'eyebrows/eyebrow005/eyebrow005.png',.6,True),1)
# Preserve separate anatomical surfaces, editable shape keys and hair cards.
armdata=bpy.data.armatures.new('Face_Rig');arm=bpy.data.objects.new('Face_Rig',armdata);bpy.context.collection.objects.link(arm);bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT');b=armdata.edit_bones.new('Head');b.head=(0,0,1.5);b.tail=(0,0,1.75);bpy.ops.object.mode_set(mode='OBJECT')
for o in [head,eyes,teeth,tongue,lashes,hair,brows]:
 group=o.vertex_groups.new(name='Head');group.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Face_Rig','ARMATURE');mod.object=arm
# Save source landmarks for fitting and stable identity mapping through future geometry refinement.
(OUT/'head-geometry.json').write_text(json.dumps({'indices':headids,'positions':world(base[headids]).tolist(),'offset':OFFSET,'scale':SCALE,'source':'MakeHuman core CC0 assets','status':'anatomical base; identity fit pending'}))
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'astrid-face-base.blend'))
print(json.dumps({'vertices':len(head.data.vertices),'faces':len(head.data.polygons),'shapes':list(names.values()),'saved':str(OUT/'astrid-face-base.blend')}))
