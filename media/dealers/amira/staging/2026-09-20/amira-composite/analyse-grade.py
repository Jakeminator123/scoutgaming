from pathlib import Path
import json, cv2, numpy as np
R=Path(__file__).resolve().parents[4];out=Path(__file__).resolve().parent
p=json.loads((R/'web/public/review/amira-composite/profile.json').read_text())
source=R/'content/staging/2026-09-20'
result={}
for kind,folder,box in [('speech',source/'amira-table-speech/greeting/frames',(604,46,666,108)),('waiting',source/'amira-table-waiting/frames',(914,97,1032,195))]:
 rgb=cv2.cvtColor(cv2.imread(str(folder/'0000.png')),cv2.COLOR_BGR2RGB)/255.
 x1,y1,x2,y2=box;skin=rgb[y1:y2,x1:x2].reshape(-1,3)
 skin=skin[(skin[:,0]-skin[:,2]>.13)&(skin[:,0]>skin[:,1])&(skin[:,1]>.25)]
 g=p[kind];lum=skin@np.array([.2126,.7152,.0722]);target=np.interp(lum,p['curveInput'],g['curve'])
 graded=skin*(target/np.maximum(lum,1e-5))[:,None]
 light=(graded.max(1)+graded.min(1))/2
 graded=(light[:,None]+(graded-light[:,None])*g['saturation'])*g['temperatureRGB']
 result[kind]={'samples':len(skin),'beforeMedianLuma':float(np.median(lum)),'afterMedianLuma':float(np.median(graded@np.array([.2126,.7152,.0722]))),'beforeMedianRGB':np.median(skin,axis=0).tolist(),'afterMedianRGB':np.median(graded,axis=0).tolist()}
result['scope']='Native forehead/cheek sample in source frame0; main grade only, excludes low-opacity wrap, shape and global finish. Different pose/texture remains.'
result['beforeLumaGap']=abs(result['speech']['beforeMedianLuma']-result['waiting']['beforeMedianLuma'])
result['afterLumaGap']=abs(result['speech']['afterMedianLuma']-result['waiting']['afterMedianLuma'])
(out/'grade-measurements.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
