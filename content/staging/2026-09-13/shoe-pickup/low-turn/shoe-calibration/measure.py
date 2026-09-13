from pathlib import Path
import numpy as np,json,hashlib
from PIL import Image,ImageDraw
D=Path(__file__).resolve().parent;B=D.parents[1]
# Manually read visible hard wall/base endpoints. Hand-occluded mouth is excluded.
names=['rear_left_wall_top','rear_right_wall_top','rear_right_wall_bottom','front_right_base','front_left_base']
game=np.array([[821,258],[858,278],[859,300],[801,359],[764,340]],float)
ready=np.array([[907,329],[954,351],[955,383],[883,458],[834,434]],float)
src=np.array([[1293,490],[1361,523],[1361,566],[1259,672],[1190,640]],float)
result={'landmarkUncertaintyPixels':{'game':2,'ready':2,'source7':3},'landmarkNames':names,'game':game.tolist(),'cases':{}}
for label,pts,w,h in [('ready',ready,1344,752),('source7',src,1920,1080)]:
 s=584/h;off=np.array([(1280-w*s)/2,0]);mapped=pts*s+off
 # Whole-image uniform scale+translation, no anisotropy or rotation.
 A=np.zeros((len(pts)*2,3));A[0::2,0]=pts[:,0];A[1::2,0]=pts[:,1];A[0::2,1]=1;A[1::2,2]=1
 fit=np.linalg.lstsq(A,game.reshape(-1),rcond=None)[0];pred=pts*fit[0]+fit[1:]
 delta=np.mean(mapped-game,axis=0)
 result['cases'][label]={'native':pts.tolist(),'runtimeScale':s,'runtimeOffset':off.tolist(),'runtimeMapped':mapped.tolist(),'runtimeResidualSourceMinusGame':(mapped-game).tolist(),'wholeUniformBestFit':fit.tolist(),'fitResidual':(pred-game).tolist(),'fitRmsPixels':float(np.sqrt(np.mean(np.sum((pred-game)**2,axis=1)))),'shoeOnlyScreenTranslationGameToSource':delta.tolist(),'translationOnlyResidual':(game+delta-mapped).tolist(),'shoeRootLocalXZDeltaKeepingHeight':[float(delta[0]/(.8111111111111111)),float(delta[1]*np.sqrt(2)/(.8111111111111111))]}
reg=json.loads((B/'gameplay-qa/live-camera/registration.json').read_text())['registration'];outlet=np.array(reg['shoe']['screen'])*[1280,720];s=584/1080;off=np.array([(1280-1920*s)/2,0]);result['registeredOutletGamePixels']=outlet.tolist();result['source7CoordinateThatWouldMapExactlyToRegisteredOutlet']=((outlet-off)/s).tolist();result['sourcePhysicalExit']='Not observable exactly: finger occludes slot/card exit. Inverse projection is a target, not a measured source landmark.'
(D/'measurement.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
