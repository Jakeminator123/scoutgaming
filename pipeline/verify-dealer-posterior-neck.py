"""Compare old and corrected posterior overlap in representative extreme actions."""
import bpy,json,sys
from pathlib import Path
from mathutils.bvhtree import BVHTree
from dealer_posterior_neck_fit import apply_posterior_neck_fit
root=Path(__file__).resolve().parents[1];output=Path(sys.argv[1]);bpy.ops.wm.open_mainfile(filepath=str(root/'assets/astrid-3d/anatomical/astrid-animated.blend'));scene=bpy.context.scene;arm=next(o for o in scene.objects if o.type=='ARMATURE');head=bpy.data.objects['Astrid_Face'];body=bpy.data.objects['char1']
for track in arm.animation_data.nla_tracks:track.mute=True
data=json.loads((Path(__file__).parent/'data/astrid-posterior-neck-fit.json').read_text());ids=[r['vertex'] for r in data['changes'] if r['before'][2]>=1.47];rows=[]
actions=['Deal_Seat_01_Contact_Study','Deal_Seat_07_Contact_Study','Greeting_Wave_Study','Accept_Bets_Nod_Study']
def check():
 result=[]
 for name in actions:
  action=bpy.data.actions[name];arm.animation_data.action=action
  if action.slots:arm.animation_data.action_slot=action.slots[0]
  lo,hi=action.frame_range
  for fraction in [.35,.55,.8]:
   frame=round(lo+(hi-lo)*fraction);scene.frame_set(frame);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();h=head.evaluated_get(dg);hm=h.to_mesh();tree=BVHTree.FromPolygons([h.matrix_world@v.co for v in hm.vertices],[list(p.vertices) for p in hm.polygons]);h.to_mesh_clear();b=body.evaluated_get(dg);bm=b.to_mesh();signed=[]
   for i in ids:
    p=b.matrix_world@bm.vertices[i].co;hit,normal,index,distance=tree.find_nearest(p);signed.append((p-hit).dot(normal))
   b.to_mesh_clear();result.append({'action':name,'frame':frame,'maximumOutwardM':max(signed),'outsideVertices':sum(s>.001 for s in signed)})
 return result
before=check();apply_posterior_neck_fit();after=check();again=apply_posterior_neck_fit();assert again['alreadyApplied']
assert all(row['outsideVertices']==0 for row in after),'Posterior neck protrudes through anatomical surface in a sampled pose'
output.write_text(json.dumps({'verticesChecked':len(ids),'before':before,'after':after,'idempotent':True,'status':'posed surface measurements; visible garment review remains separate'},indent=2));print('Before max',max(r['maximumOutwardM'] for r in before),'after max',max(r['maximumOutwardM'] for r in after),flush=True)
