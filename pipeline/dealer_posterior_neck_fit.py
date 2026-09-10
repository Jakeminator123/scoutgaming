"""Apply the reviewed local posterior-neck correction without changing topology."""
import bpy,json
from pathlib import Path
from mathutils import Vector

def apply_posterior_neck_fit():
 data=json.loads((Path(__file__).parent/'data/astrid-posterior-neck-fit.json').read_text());body=bpy.data.objects['char1'];inverse=body.matrix_world.inverted();changes=data['changes']
 if len(body.data.vertices)!=data['sourceBodyVertices']:raise ValueError('Posterior neck correction belongs to another body topology')
 def distance(row,key):return (body.matrix_world@body.data.vertices[row['vertex']].co-Vector(row[key])).length
 if all(distance(row,'after')<1e-5 for row in changes):body['posterior_neck_fit_version']=1;return {'version':1,'alreadyApplied':True,'vertices':len(changes)}
 if any(distance(row,'before')>1e-5 for row in changes):raise ValueError('Posterior neck source geometry differs; refusing a partial or mismatched correction')
 for row in changes:body.data.vertices[row['vertex']].co=inverse@Vector(row['after'])
 body.data.update();body['posterior_neck_fit_version']=1
 return {'version':1,'vertices':len(changes),'topologyAndWeightsPreserved':True,'status':'local geometry correction; posed surface review remains separate'}
