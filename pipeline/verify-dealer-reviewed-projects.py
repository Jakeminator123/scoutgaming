"""Reopen corrected projects and check packed assets, controls and fitted geometry."""
import bpy,json,sys,hashlib
from pathlib import Path
folder=Path(sys.argv[1]).resolve();report={}
for name in ['astrid-rigged.blend','astrid-animated.blend','astrid-goodluck.blend','astrid-collection-sweep.blend']:
 p=folder/name;bpy.ops.wm.open_mainfile(filepath=str(p))
 images=[i for i in bpy.data.images if i.source=='FILE' and i.users]
 assert all(i.packed_file for i in images),'Unpacked image'
 assert bpy.data.objects['char1']['posterior_neck_fit_version']==1
 assert all(bpy.data.objects[n]['oral_fit_version']==1 for n in ['Astrid_Teeth','Astrid_Tongue'])
 actions=sorted(a.name for a in bpy.data.actions)
 if name=='astrid-animated.blend':assert len(actions)==12
 if name=='astrid-goodluck.blend':
  assert len([a for a in actions if a.startswith('Speech_Goodluck_')])==5
  assert any(s.packed_file for s in bpy.data.sounds),'Original audio missing'
 if name=='astrid-collection-sweep.blend':assert len(actions)==29
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 report[name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'meshes':len(meshes),'packedImages':len(images),'shapeKeys':{o.name:len(o.data.shape_keys.key_blocks)-1 for o in meshes if o.data.shape_keys},'actions':actions,'controls':[o.name for o in bpy.context.scene.objects if o.name.startswith('CTRL_')],'oralFitVersion':1,'posteriorNeckFitVersion':1}
(folder/'reviewed-project-verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps({name:{'actions':len(v['actions']),'packedImages':v['packedImages']} for name,v in report.items()}))
