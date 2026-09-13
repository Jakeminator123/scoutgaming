import subprocess,json,statistics,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[4]
base=root/'web/public/dealers/astrid'
def skin(file,rects):
 vals=[[],[],[]]
 for x,y,w,h in rects:
  b=subprocess.check_output(['ffmpeg','-v','error','-i',str(file),'-vf',f'crop={w}:{h}:{x}:{y},format=rgb24','-frames:v','1','-f','rawvideo','-'])
  for k in range(3):vals[k]+=list(b[k::3])
 return [statistics.median(v) for v in vals]
rects=[(654,480,24,33),(777,480,24,33)]
ref=skin(base/'streams/idle-1_idle_idle.h264',rects)
# Original source camera: 1440-square actor inserted at normalized rectangle.
trans=[(round(614.4+x*.48),round(-45.27+y*.48),round(w*.48),round(h*.48)) for x,y,w,h in rects]
m=json.loads((base/'performance/manifest.json').read_text());rows=[]
for t in m['takes']:
 p=root/'web/public'/t['media']['src'];v=skin(p,trans)
 rows.append({'id':t['id'],'mediaSha256':t['media']['sha256'],'sample':v,'gain':[round(a/b,5) for a,b in zip(ref,v)]})
r={'reference':ref,'referenceROIs':rects,'performanceROIs':trans,'takes':rows}
print(json.dumps(r,indent=2));Path(__file__).with_name('measurements.json').write_text(json.dumps(r,indent=2)+'\n')
