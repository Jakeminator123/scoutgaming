"""Versioned dental occlusion and tongue-follow correction for Astrid's rig."""
import bpy,numpy as np

VERSION=1
def apply_oral_fit():
 teeth=bpy.data.objects['Astrid_Teeth'];tongue=bpy.data.objects['Astrid_Tongue']
 versions=[o.get('oral_fit_version',0) for o in [teeth,tongue]]
 if versions==[VERSION,VERSION]:return {'version':VERSION,'alreadyApplied':True}
 if versions!=[0,0]:raise ValueError('Partial or incompatible oral correction')
 blocks=teeth.data.shape_keys.key_blocks;basis=np.array([v.co[:] for v in blocks[0].data]);jaw=np.array([v.co[:] for v in blocks['jawOpen'].data])-basis
 lower=np.clip(np.linalg.norm(jaw,axis=1)/.01,0,1);lower=lower*lower*(3-2*lower);upper=1-lower
 offset=upper[:,None]*np.array([0,-.004,-.0015])
 for block in blocks:
  values=np.array([v.co[:] for v in block.data])+offset
  if block.name=='jawOpen':values[:,2]-=.005*lower
  block.data.foreach_set('co',values.ravel())
 keys=tongue.data.shape_keys.key_blocks;tv=np.array([v.co[:] for v in keys[0].data]);weight=np.clip((-.065-tv[:,1])/.035,0,1);weight=weight*weight*(3-2*weight);ids=np.where(lower>.9)[0];delta=[]
 for point in tv:
  distances=np.linalg.norm(basis[ids]-point,axis=1);near=np.argsort(distances)[:8];w=1/np.maximum(distances[near],.001);delta.append(np.average(jaw[ids[near]],axis=0,weights=w))
 delta=np.array(delta)*weight[:,None]
 for block in keys:
  values=np.array([v.co[:] for v in block.data]);values[:,1]-=.006*weight
  if block.name=='jawOpen':values+=delta
  block.data.foreach_set('co',values.ravel())
 for obj in [teeth,tongue]:obj['oral_fit_version']=VERSION;obj.data.update()
 return {'version':VERSION,'upperOffsetM':[0,-.004,-.0015],'lowerExtraOpenOffsetM':[0,0,-.005],'tongueTipForwardM':.006,'tongueJawFollow':'nearest lower dental motion, feathered to tongue root','teethVertices':len(basis),'tongueVertices':len(tv),'status':'paired static frames reviewed; complete rendered speech review remains separate'}
