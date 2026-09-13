from pathlib import Path
import subprocess,json,hashlib,sys
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2
p=Path(__file__).resolve().parent;base=p.parent.parent/'low-turn'
def white_hull(im,roi):
 x0,y0,x1,y1=roi;a=im[y0:y1,x0:x1].astype(np.int16);mask=((a.min(2)>145)&(a.max(2)-a.min(2)<38)).astype(np.uint8)*255
 cs,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);cnt=max(cs,key=cv2.contourArea);hull=cv2.convexHull(cnt);hull=hull+np.array([[[x0,y0]]]);poly=cv2.approxPolyDP(hull,cv2.arcLength(hull,True)*.025,True).reshape(-1,2)
 return hull,poly
images=[]
for name in ['anchor.png','landing-planar.png']:
 im=np.asarray(Image.open(base/name).convert('RGB'));h,w=im.shape[:2];hull,poly=white_hull(im,(int(w*.42),int(h*.48),int(w*.61),int(h*.83)));scale=min(1920/w,1080/h);edges=[float(np.linalg.norm(poly[(i+1)%len(poly)]-poly[i]))*scale for i in range(len(poly))]
 images.append({'file':name,'nativeDimensions':[w,h],'nativePolygon':poly.tolist(),'uniformScale1920':scale,'area1920':float(cv2.contourArea(hull))*scale**2,'edges1920':edges,'method':'observed white boundary convex hull; fingertip occlusion may bias boundary'})
(p/'anchor-comparison.json').write_text(json.dumps(images,indent=2)+'\n');print(json.dumps(images,indent=2))
reader=subprocess.Popen(['ffmpeg','-v','error','-i',str(base/'slide.mp4'),'-frames:v','55','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE);rows=[];tiles=[]
for n in range(55):
 raw=reader.stdout.read(1920*1080*3);assert len(raw)==1920*1080*3;im=np.frombuffer(raw,np.uint8).reshape(1080,1920,3)
 hull,poly=white_hull(im,(850,570,1160,900));center=hull.reshape(-1,2).mean(0)
 # A candidate visible skin-boundary point, NOT a proof of physical pressure.
 x0,y0,x1,y1=820,510,1160,850;a=im[y0:y1,x0:x1].astype(np.int16);r,g,b=[a[:,:,i] for i in range(3)]
 mask=((r-g>22)&(r-b>35)&(r>85)&(g>45)).astype(np.uint8)
 count,labels,stats,centers=cv2.connectedComponentsWithStats(mask,8);candidates=[]
 for k in range(1,count):
  ys,xs=np.where(labels==k)
  # Connected hand region must extend appreciably above the visible paper.
  if len(ys)<40 or ys.min()+y0>poly[:,1].min()-12:continue
  pts=np.column_stack([xs+x0,ys+y0]);idx=np.argmin(np.linalg.norm(pts-center,axis=1));point=pts[idx]
  gap=cv2.pointPolygonTest(hull,tuple(map(float,point)),True)
  if gap>=-8:candidates.append((float(np.linalg.norm(point-center)),point,float(gap)))
 point=min(candidates,key=lambda v:v[0])[1] if candidates else None
 rows.append({'frame':n,'seconds':n/24,'visiblePaperHullNative':hull.reshape(-1,2).tolist(),'visiblePaperPolygonNative':poly.tolist(),'footprintConfidence':'medium-visible-white-boundary; hull spans occluded areas, not measured hidden corners','fingerCandidateNative':point.tolist() if point is not None else None,'fingerCandidateNormalized':(point/np.array([1920,1080])).tolist() if point is not None else None,'contactMeasured':False,'confidence':'candidate-needs-manual-review' if point is not None else 'missing','method':'nearest connected visible-skin point to observed paper hull center'})
 marked=Image.fromarray(im.copy());d=ImageDraw.Draw(marked);q=[tuple(map(int,v)) for v in poly];d.line(q+[q[0]],fill='cyan',width=2)
 if point is not None:
  x,y=map(int,point);d.ellipse((x-4,y-4,x+4,y+4),outline='red',width=2)
 tile=marked.crop((820,550,1160,900)).resize((340,350));panel=Image.new('RGB',(340,375),'#171717');panel.paste(tile,(0,0));ImageDraw.Draw(panel).text((8,355),f'n{n:02d} CYAN paper / RED candidate',fill='white');tiles.append(panel)
assert reader.wait()==0
for i in range(5):
 sheet=Image.new('RGB',(1360,1125),'#171717')
 for j,tile in enumerate(tiles[i*12:(i+1)*12]):sheet.paste(tile,(j%4*340,j//4*375))
 sheet.save(p/f'candidate-review-{i}.jpg',quality=94)
(p/'observations.json').write_text(json.dumps({'status':'diagnostic-not-contact-calibrated','sourceSha256':hashlib.sha256((base/'slide.mp4').read_bytes()).hexdigest(),'sourceDimensions':[1920,1080],'frames':rows},indent=2)+'\n')
