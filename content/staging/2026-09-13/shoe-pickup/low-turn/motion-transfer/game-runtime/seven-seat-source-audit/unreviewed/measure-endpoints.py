import pathlib
exec(open(pathlib.Path(__file__).with_name('inspect-samples.py')).read().split('paths=')[0])
import numpy as np
records=json.load(open(o/'samples.json'));results=[]
for row in records:
 c=cv2.VideoCapture(row['path']); c.set(cv2.CAP_PROP_POS_FRAMES,row['nativeFrames']-1);ok,a=c.read();h,w=a.shape[:2]; b=a[int(h*.55):int(h*.84),int(w*.1):int(w*.63)]; z=cv2.cvtColor(b,cv2.COLOR_BGR2RGB); m=((z.min(2)>140)&(z.max(2)-z.min(2)<65)).astype('uint8')*255
 cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);cs=[x for x in cs if cv2.contourArea(x)>150]; cs.sort(key=cv2.contourArea,reverse=True)
 if cs:
  co=cs[0]+np.array([[[int(w*.1),int(h*.55)]]]);mom=cv2.moments(co);center=[mom['m10']/mom['m00'],mom['m01']/mom['m00']];quad=cv2.boxPoints(cv2.minAreaRect(co)).tolist();cv2.drawContours(a,[co],-1,(0,0,255),2);cv2.imwrite(str(o/(pathlib.Path(row['path']).parent.name+'-endpoint.jpg')),a);results.append({'path':row['path'],'native':row['nativeFrames']-1,'whiteHullCentroid':center,'visibleWhiteMinAreaRect':quad,'method':'Final exposed white contour within table ROI, manually review overlay. Not hidden-corner or physical-camera measurement.'})
json.dump(results,open(o/'endpoints.json','w'),indent=2);print(json.dumps(results,indent=2))
