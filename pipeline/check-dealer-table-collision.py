"""Evaluate deformed dealer vertices against actual table-apron clearance.

This detects deep geometry penetration; it cannot certify finger grip or
photorealistic performance. Run against the delivered animation source.
"""
import bpy,json,sys,argparse,numpy as np
from pathlib import Path
R=Path(__file__).resolve().parents[1]
motion=json.loads((R/'assets/astrid-3d/motion-samples.json').read_text())
expected={(s['action'],s['frame']):np.array(s['bones']['Head'][12:15]) for s in motion['samples']}
parser=argparse.ArgumentParser()
parser.add_argument('source',nargs='?',type=Path,default=R/'assets/astrid-3d/astrid-animated.blend')
parser.add_argument('--all-frames',action='store_true')
args=parser.parse_args();source=args.source
out=R/'content/staging/2026-09-10/rig-game-qa';out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene;arm=next(o for o in scene.objects if o.type=='ARMATURE')
mesh=next(o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
arm.animation_data_create()
for track in arm.animation_data.nla_tracks:track.mute=True
samples=[]
for action in bpy.data.actions:
    if not action.name.endswith('_Study'):continue
    arm.animation_data.action=action
    if hasattr(action,'slots') and action.slots:arm.animation_data.action_slot=action.slots[0]
    end=max(2,round(action.frame_range[1]));frames=range(1,end+1) if args.all_frames else sorted(set(round(1+(end-1)*f) for f in (0,.20,.36,.54,.69,.84,1)))
    for frame in frames:
        scene.frame_set(frame);bpy.context.view_layer.update()
        head=arm.matrix_world@arm.pose.bones['Head'].head
        head_error=float(np.linalg.norm(np.array((head.x,head.z,-head.y))-expected[(action.name,frame)]))
        if head_error>.01:raise RuntimeError(f'Native rig registration invalid: {action.name} frame {frame}, head error {head_error*1000:.2f} mm')
        evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=evaluated.to_mesh()
        coords=np.empty(len(data.vertices)*3,dtype=np.float64);data.vertices.foreach_get('co',coords);coords=coords.reshape((-1,3))
        m=np.array(evaluated.matrix_world);world=coords@m[:3,:3].T+m[:3,3]
        x,y,z=world[:,0],world[:,2],-world[:,1];ax=np.abs(x)
        back=np.full_like(x,-.15);mid=ax<=.26;corner=(ax>.26)&(ax<.5)
        back[mid]=.16;back[corner]=-.15+.31*np.sqrt(np.maximum(0,1-((ax[corner]-.26)/.24)**2))
        footprint=(x/1.16)**2+((z+.15)/1.25)**2<1
        inside=footprint&(z>back+.003)&(y>.773)&(y<.903)
        ids=np.where(inside)[0];points=world[ids]
        samples.append({'action':action.name,'frame':frame,'nativeHeadErrorMm':head_error*1000,'deepApronVertices':int(len(ids)),
          'worstDepthMm':float(np.max(.910-y[ids])*1000) if len(ids) else 0,
          'examplesEngine':[[float(x[i]),float(y[i]),float(z[i])] for i in ids[:3]]})
        evaluated.to_mesh_clear()
result={'source':str(source),'everyAuthoredFrame':args.all_frames,'samples':samples,'framesWithDeepPenetration':sum(s['deepApronVertices']>0 for s in samples),
 'criterion':'Actual deformed skin/clothing vertices >7mm below felt, >3mm inside physical apron footprint.',
 'limits':['Samples are discrete frames, not a continuous swept-volume check.','Does not validate fingertip grip, shoe collision, contact shadows, face or motion aesthetics.']}
(out/'deformed-apron-collision.json').write_text(json.dumps(result,indent=2))
print(json.dumps({'frames':len(samples),'failedFrames':result['framesWithDeepPenetration'],'worst':sorted(samples,key=lambda s:s['deepApronVertices'],reverse=True)[:5]}))
if result['framesWithDeepPenetration']:sys.exit(1)
