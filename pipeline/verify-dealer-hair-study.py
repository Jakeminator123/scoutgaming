"""Check that a groom revision preserves the dealer and follows the head rigidly."""
import bpy,json,sys,hashlib,numpy as np
from pathlib import Path
from mathutils import Matrix,Vector
source=Path(sys.argv[1]);candidate=Path(sys.argv[2]);output=Path(sys.argv[3])
def snapshot(path):
 bpy.ops.wm.open_mainfile(filepath=str(path.resolve()));result={}
 for name in ['char1','Astrid_Face','Astrid_Eyes','Astrid_Teeth','Astrid_Tongue','Astrid_Eyelashes']:
  obj=bpy.data.objects[name];h=hashlib.sha256()
  for vertices in [obj.data.vertices]+([b.data for b in obj.data.shape_keys.key_blocks] if obj.data.shape_keys else []):
   values=np.empty(len(vertices)*3,dtype=np.float32);vertices.foreach_get('co',values);h.update(values.tobytes())
  h.update(repr([(p.vertices[:]) for p in obj.data.polygons]).encode());h.update(repr([[(g.group,g.weight) for g in v.groups] for v in obj.data.vertices]).encode());result[name]=h.hexdigest()
 return result
before=snapshot(source);after=snapshot(candidate);assert before==after,'Dealer geometry, shapes or skin weights changed'
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
if arm.animation_data:
 arm.animation_data.action=None
 for track in arm.animation_data.nla_tracks:track.mute=True
for bone in arm.pose.bones:bone.matrix_basis.identity()
names=['Astrid_Hair','Astrid_Hair_Fibers','Astrid_Hair_Bun_Core']
def head_space():
 bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
 # The imported armature has scale .01. Normalize its frame so distances stay
 # in world metres rather than being inflated into armature centimetres.
 location,rotation,scale=(arm.matrix_world@arm.pose.bones['Head'].matrix).decompose();frame=rotation.to_matrix().to_4x4();frame.translation=location;inverse=frame.inverted();result={}
 for name in names:
  obj=bpy.data.objects[name];assert obj.parent==arm
  group=obj.vertex_groups['Head'].index;assert all(abs(sum(g.weight for g in v.groups if g.group==group)-1)<1e-6 for v in obj.data.vertices)
  ev=obj.evaluated_get(dg);mesh=ev.to_mesh();ids=np.linspace(0,len(mesh.vertices)-1,64,dtype=int);result[name]=[inverse@ev.matrix_world@mesh.vertices[int(i)].co for i in ids];ev.to_mesh_clear()
 return result
rest=head_space();maximum=0;poses=[]
for axis,angle,shift in [('X',.3,0),('X',-.3,0),('Y',.3,0),('Z',.35,0),('Z',-.35,0),('Z',0,.05)]:
 arm.pose.bones['Head'].matrix_basis=Matrix.Rotation(angle,4,axis);arm.location.x=shift;posed=head_space();byObject={name:max((a-b).length for a,b in zip(rest[name],posed[name]))*1000 for name in names};error=max(byObject.values())/1000;maximum=max(maximum,error);poses.append({'axis':axis,'radians':angle,'bodyTranslationM':shift,'maximumHeadSpaceErrorMm':error*1000,'byObjectMm':byObject})
report={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'candidateSha256':hashlib.sha256(candidate.read_bytes()).hexdigest(),'protectedMeshHashes':before,'unchangedDealerMeshes':list(before),'sampledPoses':poses,'maximumRigidAttachmentErrorMm':maximum*1000,'limitMm':.01,'hairVertices':{name:len(bpy.data.objects[name].data.vertices) for name in names},'editableStrands':len(bpy.data.objects['SOURCE_Continuous_Swept_Groom'].data.splines),'status':'geometry preservation and rigid attachment verified; visual/export acceptance separate' if maximum<1e-5 else 'attachment tolerance failed'}
output.write_text(json.dumps(report,indent=2));print(json.dumps(report))
assert maximum<1e-5,maximum
