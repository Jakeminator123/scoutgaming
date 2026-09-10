"""Editable metre-scale blackjack table, separate props, GLB and review renders.

Run with the project's Blender Python environment. Coordinates in this script
are engine coordinates (X right, Y up, Z towards the player); p() maps to bpy.
No gameplay state is simulated here. Shoe parts and card face materials are
named attachment points for the existing authoritative game.
"""
import bpy, bmesh, math, json, sys, os, shutil
from pathlib import Path
from mathutils import Vector
import numpy as np

REPO=Path(__file__).resolve().parents[1]
OUT=REPO/'assets/blackjack-3d'
PUBLIC=REPO/'web/public/assets/blackjack-3d'
OUT.mkdir(parents=True,exist_ok=True); PUBLIC.mkdir(parents=True,exist_ok=True)
TEX=OUT/'textures'; TEX.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=1
scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.render.resolution_x=1400; scene.render.resolution_y=980; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
scene.render.fps=30; scene.frame_start=1; scene.frame_end=90

def p(v): return (v[0],-v[2],v[1])
def mat(name,color,rough=.5,metal=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    return m

def texture(name,base,amplitude,seed):
    rng=np.random.default_rng(seed); n=512
    fine=rng.uniform(-1,1,(n,n)); xx,yy=np.meshgrid(np.arange(n),np.arange(n))
    fibre=.55*fine+.20*np.sin(xx*math.pi/2)+.15*np.sin(yy*math.pi/3)
    rgb=np.clip(np.array(base)[None,None,:]+fibre[:,:,None]*amplitude,0,1)
    rgba=np.concatenate([rgb,np.ones((n,n,1))],axis=2).astype(np.float32)
    image=bpy.data.images.new(name,width=n,height=n,alpha=True)
    image.pixels.foreach_set(rgba.ravel());image.filepath_raw=str(TEX/(name+'.png'));image.file_format='PNG';image.save();image.pack()
    dx=np.roll(fine,1,axis=1)-np.roll(fine,-1,axis=1);dy=np.roll(fine,1,axis=0)-np.roll(fine,-1,axis=0)
    normal=np.stack([dx*.13,dy*.13,np.ones((n,n))],axis=2);normal/=np.linalg.norm(normal,axis=2)[:,:,None]
    rgba=np.concatenate([normal*.5+.5,np.ones((n,n,1))],axis=2).astype(np.float32)
    ni=bpy.data.images.new(name+' normal',width=n,height=n,alpha=True);ni.colorspace_settings.name='Non-Color';ni.pixels.foreach_set(rgba.ravel())
    ni.filepath_raw=str(TEX/(name+'-normal.png'));ni.file_format='PNG';ni.save();ni.pack()
    return image,ni

def textured(m,imgs,scale):
    nt=m.node_tree;bs=nt.nodes.get('Principled BSDF')
    uv=nt.nodes.new('ShaderNodeTexCoord');mapping=nt.nodes.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs[3].default_value=scale
    nt.links.new(uv.outputs['UV'],mapping.inputs[0])
    # UV scaling is baked into mesh UVs for portable glTF; keep a unit mapping.
    mapping.inputs[3].default_value=1
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=imgs[0];nt.links.new(mapping.outputs[0],tex.inputs[0]);nt.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    ntex=nt.nodes.new('ShaderNodeTexImage');ntex.image=imgs[1];nt.links.new(mapping.outputs[0],ntex.inputs[0])
    norm=nt.nodes.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=.24;nt.links.new(ntex.outputs['Color'],norm.inputs['Color']);nt.links.new(norm.outputs['Normal'],bs.inputs['Normal'])

felt=mat('Felt | deep emerald',(.016,.115,.060),.96)
felt.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.14
leather=mat('Rail | black leather',(.014,.015,.017),.4)
textured(felt,texture('felt',(.055,.30,.16),.016,20),1)
textured(leather,texture('leather',(.050,.052,.057),.010,29),1)
wood=mat('Body | smoked walnut',(.025,.019,.015),.33)
gold=mat('Inlay | satin champagne gold',(.56,.40,.16),.28,.8)
ink=mat('Felt markings | antique gold ink',(.42,.33,.15),.8,.12)
rubber=mat('Shoe base | matte graphite',(.012,.018,.023),.43)
paper=mat('Cards | warm ivory edges',(.88,.86,.79),.82)
face=mat('CardFace | replace with server card texture',(.96,.95,.89),.7)
red=mat('Cut card | oxblood red',(.45,.018,.020),.42)
acrylic=mat('Acrylic | clear 3mm panels',(.85,.94,.96),.085)
bs=acrylic.node_tree.nodes.get('Principled BSDF');bs.inputs['Transmission Weight'].default_value=.94;bs.inputs['IOR'].default_value=1.49
steel=mat('Shoe fixings | brushed steel',(.46,.49,.48),.22,.9)
stitch=mat('Rail stitching | dark taupe',(.11,.09,.065),.9)
back=mat('CardBack | Scout original',(.012,.024,.037),.64)
backpath=REPO/'web/public/assets/cardback.png'
if backpath.exists():
    img=bpy.data.images.load(str(backpath),check_existing=True);img.pack();shutil.copy2(backpath,TEX/'cardback.png')
    node=back.node_tree.nodes.new('ShaderNodeTexImage');node.image=img
    back.node_tree.links.new(node.outputs['Color'],back.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

def empty(name,pos=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=p(pos)
    if parent:o.parent=parent
    o.empty_display_type='PLAIN_AXES';o.empty_display_size=.03;return o
root=empty('Blackjack_Table_Root'); table=empty('Table_Structure',parent=root)
props=empty('Independent_Props',parent=root); targets=empty('Animation_Sockets',parent=root)

def finish(o,name,material,parent,bevel=0):
    o.name=name;o.data.materials.append(material)
    if parent:o.parent=parent
    if bevel:
        mod=o.modifiers.new('Editable edge rounding','BEVEL');mod.width=bevel;mod.segments=4
        mod=o.modifiers.new('Corner normals','WEIGHTED_NORMAL')
    return o
def box(name,pos,size,material,parent=None,bevel=.002):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p(pos));o=bpy.context.object
    o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,material,parent,bevel)
def cylinder(name,pos,radius,depth,material,parent=None,vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=p(pos));o=bpy.context.object
    return finish(o,name,material,parent,.0005)
def tube(name,points,radius,material,parent=None):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.bevel_depth=radius;data.bevel_resolution=4
    spline=data.splines.new('POLY');spline.points.add(len(points)-1)
    for dst,src in zip(spline.points,points):dst.co=(*p(src),1)
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.data.materials.append(material)
    if parent:o.parent=parent
    return o
def halfdisc(name,rx,rz,y,thickness,material):
    N=128
    # Concave dealer opening is physical clearance, not a hidden body overlap.
    notch=[(-.26-.24*math.cos(a),-.15+.31*math.sin(a)) for a in np.linspace(0,math.pi/2,21)]
    notch+=[(.26+.24*math.sin(a),-.15+.31*math.cos(a)) for a in np.linspace(0,math.pi/2,21)]
    contour=[(-rx,-.15)]+notch+[(rx,-.15)]+[(rx*math.cos(a),-.15+rz*math.sin(a)) for a in np.linspace(0,math.pi,N+1)[1:]]
    n=len(contour);verts=[p((x,height,z)) for height in (y-thickness,y) for x,z in contour]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
    uv=mesh.uv_layers.new(name='Material UV')
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            v=mesh.vertices[mesh.loops[li].vertex_index].co
            uv.data[li].uv=(v.x*5,-v.y*5)
    o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);finish(o,name,material,table,.006 if thickness>.01 else .001)
    return o

halfdisc('Table | walnut apron',1.16,1.25,.893,.125,wood)
halfdisc('Table | emerald playing surface',1.095,1.17,.910,.010,felt)
arc=[(1.115*math.cos(a),.935,-.15+1.19*math.sin(a)) for a in np.linspace(0,math.pi,193)]
rail=tube('Rail | padded leather',arc,.055,leather,table)
tube('Rail | lower gold reveal',[(x,.882,z) for x,_,z in arc],.004,gold,table)
tube('Rail | inside seam',[(x*.952,.944,(z+.15)*.952-.15) for x,_,z in arc],.0008,stitch,table)
# The back rail leaves an open working edge for both of Astrid's forearms.
for side in (-1,1):
    tube('Rail | rear '+str(side),[(side*x,.928,-.145) for x in np.linspace(.53,1.115,20)],.037,leather,table)
    box('Pedestal | '+str(side),(side*.66,.432,.45),(.27,.70,.44),wood,table,.048)
    box('Foot | '+str(side),(side*.66,.049,.45),(.40,.07,.59),rubber,table,.024)
    box('Pedestal gold collar | '+str(side),(side*.66,.12,.45),(.282,.016,.452),gold,table,.012)

seat_positions=[]
for seat in range(7):
    angle=math.pi*.15+seat*(math.pi*.70/6)
    x,z=math.cos(angle)*.91-.045,math.sin(angle)*.66-.05
    seat_positions.append([x,.911,z]);empty('Seat_%02d_Card_Landing'%(seat+1),(x,.911,z),targets)
    bx,bz=math.cos(angle)*.95,math.sin(angle)*.92-.11
    pts=[(bx+.047*math.cos(a),.9115,bz+.047*math.sin(a)) for a in np.linspace(0,2*math.pi,65)]
    tube('Betting ink | seat %d'%(seat+1),pts,.00065,ink,table)
empty('Dealer_Cards',(0,.911,.23),targets)
empty('Player_Camera',(0,1.62,2.55),targets)
empty('Dealer_Origin',(0,0,-.25),targets)

# Shoe is a hierarchy. Its outlet is the reference point, not the pack centre.
shoe=empty('Shoe_Root',(.56,.910,.11),props)
shoe['state_source']='existing server shoe snapshot; never independently draw cards'
box('Shoe_Base',(0,.007,-.105),(.086,.010,.244),rubber,shoe,.006)
for s in (-1,1):
    # Flat acrylic panels with measured front and rear wall heights.
    verts=[p((s*.041,y,z)) for y,z in ((.01,.009),(.01,-.224),(.111,-.224),(.065,.009))]
    mesh=bpy.data.meshes.new('Acrylic wall');mesh.from_pydata(verts,[],[(0,1,2,3)]);mesh.update()
    o=bpy.data.objects.new('Shoe_Acrylic_'+('Left' if s<0 else 'Right'),mesh);scene.collection.objects.link(o);o.parent=shoe;o.data.materials.append(acrylic)
    solid=o.modifiers.new('3mm clear acrylic','SOLIDIFY');solid.thickness=.003
    bevel=o.modifiers.new('Polished panel edges','BEVEL');bevel.width=.0007;bevel.segments=3
    for j in (0,1):
        screw=cylinder('Shoe fixing %d %d'%(s,j),(s*.035,.014,-.02-j*.18),.0015,.001,steel,shoe,16)
box('Shoe_RearPanel',(0,.059,-.222),(.085,.101,.003),acrylic,shoe,.0007)
box('Shoe_Outlet_Lip',(0,.019,.010),(.062,.006,.018),rubber,shoe,.002)
outlet=empty('Shoe_Outlet',(0,.025,0),shoe)
outlet['meaning']='front extraction edge; Three world [.56,.935,.11]'
stack=empty('Shoe_CardStack',(0,.053,-.015),shoe)
pack=box('Shoe_Pack',(0,0,-.0875),(.063,.080,.175),paper,stack,.0012)
pack['remaining_axis']='local Y in Blender / negative Z in engine; keep front fixed'
# Fine physical card edges, shared material. Never render generated game ranks.
for i in range(1,96):
    z=-.175*i/96
    tube('Pack edge %03d'%i,[(-.0316,-.040,z),(-.0316,.040,z),(.0316,.040,z),(.0316,-.040,z)],.000065,stitch,stack)
front=box('Shoe_FrontCard',(0,0,.0005),(.063,.080,.0005),back,stack,.00015)
cut=box('Shoe_CutCard',(0,.006,-.131),(.067,.088,.0006),red,stack,.0003)
cut['meaning']='red marker only; not a playable card'
follower=box('Shoe_Pusher',(0,0,-.180),(.061,.075,.009),rubber,stack,.003)
empty('CutCard_Removed',(.10,.003,0),shoe)

discard=empty('Discard_Root',(-.91,.910,.25),props)
box('Discard_Base',(0,.004,0),(.080,.006,.110),rubber,discard,.003)
for x in (-.039,.039):box('Discard_Side', (x,.034,0),(.003,.067,.110),acrylic,discard,.0006)
box('Discard_Rear',(0,.034,-.053),(.080,.067,.003),acrylic,discard,.0006)
empty('Discard_Landing',(0,.010,0),discard)

# Independent card geometry; face/back material slots survive the GLB export.
cardroot=empty('Card_Template',(-.12,.911,.24),props)
card=box('Card_Edge',(0,.0002,0),(.063,.0004,.088),paper,cardroot,.00015)
for side,material in ((1,face),(-1,back)):
    bpy.ops.mesh.primitive_plane_add(size=1,location=(0,0,0));o=bpy.context.object;o.scale=(.0624,.0874,1)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.location=p((0,.0002+side*.000205,0));o.parent=cardroot
    if side<0:o.rotation_euler.x=math.pi
    finish(o,'Card_Face' if side>0 else 'Card_Back',material,None)
cardroot['card_dimensions_metres']=[.063,.0004,.088]
cardroot['card_identity']='blank face template; existing server supplies rank and suit'

chip_colors=[('1',(.51,.027,.03)),('5',(.012,.27,.22)),('25',(.58,.20,.028)),('100',(.014,.26,.046)),('500',(.22,.047,.38)),('1000',(.018,.022,.030))]
white=mat('Chip inserts | ivory',(.89,.88,.82),.48)
for idx,(value,color) in enumerate(chip_colors):
    cm=mat('Chip denomination '+value,color,.44)
    g=empty('Chip_'+value,(-.20+idx*.08,.912,.45),props)
    cylinder('Chip_'+value+'_Body',(0,.00165,0),.0195,.0033,cm,g,64)
    cylinder('Chip_'+value+'_Centre',(0,.00334,0),.013,.0001,white,g,48)
    for j in range(8):
        a=j*math.tau/8
        insert=box('Chip_'+value+'_Insert_'+str(j),(.0168*math.cos(a),.00165,.0168*math.sin(a)),(.0048,.00335,.0035),white,g,.00025)
        insert.rotation_euler.z=-a
    g['diameter_metres']=.039;g['thickness_metres']=.0033;g['value']=value

templates=empty('Prop_Templates',parent=props)
cardroot.parent=templates
for value,_ in chip_colors:bpy.data.objects['Chip_'+value].parent=templates

def label(name,text,pos,size,material,parent):
    data=bpy.data.curves.new(name,'FONT');data.body=text;data.size=size
    data.align_x='CENTER';data.align_y='CENTER';data.extrude=0;data.resolution_u=8
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=p(pos)
    o.parent=parent;o.data.materials.append(material);return o
label('Table rule | blackjack','BLACKJACK PAYS 3 TO 2',(0,.9118,.38),.025,ink,table)
label('Table rule | insurance','INSURANCE PAYS 2 TO 1',(0,.9118,.43),.017,ink,table)
for idx,(value,color) in enumerate(chip_colors):
    g=bpy.data.objects.get('Chip_'+value)
    label('Chip_'+value+'_Value',value,(0,.00341,0),.010,rubber,g)

tray=empty('ChipTray_Root',(-.76,.910,.035),props)
box('ChipTray_Base',(0,-.004,0),(.41,.018,.095),rubber,tray,.005)
for x in (-.21,.21):box('ChipTray_Side',(x,.004,0),(.007,.018,.107),rubber,tray,.002)
for z in (-.052,.052):box('ChipTray_Rim',(0,.004,z),(.426,.018,.007),rubber,tray,.002)
for idx,(value,color) in enumerate(chip_colors):
    cm=bpy.data.materials.get('Chip denomination '+value)
    x=(idx-2.5)*.060
    box('ChipTray_Divider_'+str(idx),(x+.030,.010,0),(.003,.019,.093),rubber,tray,.001)
    for j in range(15):
        # Independent chip bodies, sharing one mesh per denomination.
        pos=(x,.012,-.034+j*.0047)
        if j==0:
            o=cylinder('Tray_Chip_'+value+'_%02d'%j,pos,.0195,.0033,cm,tray,32)
            o.rotation_euler.x=math.pi/2
            exemplar=o
        else:
            o=exemplar.copy();o.data=exemplar.data;scene.collection.objects.link(o);o.name='Tray_Chip_'+value+'_%02d'%j;o.location=p(pos)
        o['value']=value

# A restrained continuous room: actual geometry, no divided image plates.
room=empty('Room_Root')
wallmat=mat('Room | charcoal bronze',(.038,.030,.021),.66,.18)
floor=mat('Room | charcoal carpet',(.014,.019,.018),.99)
box('Room floor',(0,-.027,0),(10,.04,10),floor,room,0)
box('Room rear wall',(0,1.8,-2.4),(8,3.6,.10),wallmat,room,.008)
for i in range(-4,5):
    x=i*.82
    box('Wall panel '+str(i),(x,1.62,-2.338),(.71,3.20,.035),wood,room,.007)
    box('Wall gold seam '+str(i),(x+.38,1.7,-2.313),(.009,3.3,.006),gold,room,.001)
warm=mat('Pendant diffuser | warm ivory',(.8,.64,.38),.45)
bs=warm.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(1,.75,.4,1);bs.inputs['Emission Strength'].default_value=1.4
for x,y,z in ((0,2.14,-1.5),(-2.1,1.99,-1.75),(2.1,1.99,-1.75)):
    box('Pendant casing',(x,y,z),(1.10,.046,.11),rubber,room,.012)
    box('Pendant lit underside',(x,y-.025,z),(.98,.009,.073),warm,room,.003)
    for offset in (-.43,.43):box('Pendant suspension',(x+offset,y+.55,z),(.003,1.06,.003),rubber,room,.0005)

def light(name,pos,power,color,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=p(pos);o.rotation_euler=(Vector(p((0,.8,.2)))-o.location).to_track_quat('-Z','Y').to_euler();return o
light('Key | warm ceiling softbox',(-1.2,3.3,1.1),230,(1,.84,.65),2.3)
light('Fill | soft neutral bounce',(2.3,2.5,1.7),160,(.78,.87,1),2.0)
light('Rim | salon pendant',(.3,2.8,-1.8),210,(1,.79,.51),1.3)
scene.world.color=(.08,.08,.08)
data=bpy.data.cameras.new('Player seated lens');camera=bpy.data.objects.new('Player seated lens',data);scene.collection.objects.link(camera)
camera.location=p((0,1.75,2.60));camera.rotation_euler=(Vector(p((0,.89,.25)))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=36
scene.camera=camera

# Save the editable detailed source before changing modifier resolution for export.
scene['production_state']='TABLE/PROP CANDIDATE; dealer rig and gameplay acceptance separate'
scene['engine_axes']='glTF Y up, X right, Z toward seated player; metres'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'blackjack-table-detailed.blend'))
for o in scene.objects:
    for mod in o.modifiers:
        if mod.type=='BEVEL':mod.segments=min(mod.segments,2)
    if o.type=='CURVE':o.data.bevel_resolution=2
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'blackjack-table-optimized.blend'))

def export(path,objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
tableobjects=[root]+list(root.children_recursive)
export(OUT/'blackjack-table.glb',tableobjects)
export(OUT/'blackjack-room.glb',[room]+list(room.children_recursive))
for name in ('blackjack-table.glb','blackjack-room.glb'):shutil.copy2(OUT/name,PUBLIC/name)
profile={'version':1,'units':'metres','axes':'glTF Y-up, X-right, Z-toward-player','feltHeight':.910,'outlet':[.56,.935,.11],'dealerCards':[0,.911,.23],'seatCards':seat_positions,'cardDimensions':[.063,.0004,.088],'chipDiameter':.039,'sourceDetailed':'blackjack-table-detailed.blend','sourceOptimized':'blackjack-table-optimized.blend','socketNames':['Shoe_Outlet','Dealer_Cards','Discard_Landing']+['Seat_%02d_Card_Landing'%i for i in range(1,8)],'limitations':['Table and prop asset candidate; no dealer or gameplay integration approval.','Card template is intentionally blank; server-issued faces must be applied at runtime.','Shoe pack and cut marker are separate nodes; blackjack-asset-state.mjs maps public backend snapshots.']}
(OUT/'profile.json').write_text(json.dumps(profile,indent=2));shutil.copy2(OUT/'profile.json',PUBLIC/'profile.json')
scene.render.filepath=str(OUT/'table-player-camera.png');bpy.ops.render.render(write_still=True)
camera.location=p((1.65,2.20,2.45));camera.rotation_euler=(Vector(p((0,.65,.30)))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(OUT/'table-three-quarter.png');bpy.ops.render.render(write_still=True)
print(json.dumps({'output':str(OUT),'objects':len(tableobjects),'glbBytes':(OUT/'blackjack-table.glb').stat().st_size,'profile':profile}))
