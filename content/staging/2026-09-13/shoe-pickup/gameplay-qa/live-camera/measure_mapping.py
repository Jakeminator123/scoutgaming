from pathlib import Path
import json,numpy as np
p=Path(__file__).parent
r=json.loads((p/'registration.json').read_text())['registration'];outlet=np.array(r['shoe']['screen'])*[r['viewport']['width'],r['viewport']['height']]
# Manual source/target screenshot landmarks. Approximation explicitly retained.
src=np.array([[670,106],[850,439],[670,380]],float)
dst=np.array([[640,85],outlet,[640,300]],float)
sc=src-src.mean(0);dc=dst-dst.mean(0);scale=float((sc*dc).sum()/(sc*sc).sum());t=dst.mean(0)-scale*src.mean(0)
contain=min(1280/1344,720/752);offset=np.array([(1280-1344*contain)/2,(720-752*contain)/2])
report={'modelOutletExactPixels':outlet.tolist(),'manualLandmarks':{'names':['eye-line centre','shoe mouth','rear rail at centre'],'source':src.tolist(),'target':dst.tolist(),'uncertaintyPixels':'approximately 3-8px source/target except exact model outlet'},'contain':{'scale':contain,'offset':offset.tolist(),'sourceMapped':(src*contain+offset).tolist(),'deltaFromTarget':(src*contain+offset-dst).tolist()},'uniformLeastSquaresNoRotation':{'scale':scale,'translation':t.tolist(),'sourceMapped':(src*scale+t).tolist(),'residualPixels':(src*scale+t-dst).tolist(),'sourceExtentInGame':[t[0],t[1],1344*scale,752*scale]},'warning':'Manual point fit supports global actor+shoe registration candidate, not exact multi-frame finger contact or background acceptance.'}
(p/'mapping.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
runtime_scale=min(1280/1344,(720-136)/752);runtime_offset=np.array([(1280-1344*runtime_scale)/2,0])
shoulders=np.array([[580,180],[760,180]],float);target_shoulders=np.array([[575,147],[708,147]],float)
report['actualRuntimeFit']={'provenance':'web/public/performance-contact.mjs:166-175; desktop reserves136px control band','scale':runtime_scale,'offset':runtime_offset.tolist(),'sourceMapped':(src*runtime_scale+runtime_offset).tolist(),'deltaFromTarget':(src*runtime_scale+runtime_offset-dst).tolist(),'manualShouldersMapped':(shoulders*runtime_scale+runtime_offset).tolist(),'manualShoulderDelta':(shoulders*runtime_scale+runtime_offset-target_shoulders).tolist()}
(p/'mapping.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report['actualRuntimeFit'],indent=2))
