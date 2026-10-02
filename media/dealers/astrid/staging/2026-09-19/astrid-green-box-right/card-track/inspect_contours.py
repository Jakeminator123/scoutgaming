"""Raw chroma/marker contour diagnostic for the box-right take (no gameplay edits).

Tracks the green prop by nearest centroid to the previous frame instead of the
largest blob, because skin and hair otherwise win once the hand covers the
card. Emits per-frame evidence and raw crop sheets for inspection before the
plane is authored in build_track.py.
"""
from pathlib import Path
import cv2,numpy as np,json
from PIL import Image,ImageDraw
P=Path(__file__).parent
FRAMES=P.parent/'mask'/'frames'
frames=[];entries=[];prev=np.array([1274.,652.])
for n in range(97):
    im=cv2.imread(str(FRAMES/f'{n:04}.png'));hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
    # The prop darkens to hue~64 once flat on the felt at viewer-right; felt stays hue~71 at V~120.
    lime=cv2.bitwise_or(cv2.inRange(hsv,np.array([35,70,105]),np.array([57,255,255])),cv2.inRange(hsv,np.array([57,110,150]),np.array([68,255,255])))
    magenta=cv2.inRange(hsv,np.array([135,90,60]),np.array([175,255,255]))
    mask=cv2.bitwise_or(lime,magenta)
    mask[:480]=0;mask[:,:700]=0;mask[:,1700:]=0
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    ct,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    ct=[c for c in ct if cv2.contourArea(c)>60]
    ent={'frame':n,'contours':len(ct)}
    chosen=None
    if ct:
        def score(c):
            m=cv2.moments(c);cxy=np.array([m['m10']/m['m00'],m['m01']/m['m00']])
            return np.linalg.norm(cxy-prev)-0.02*cv2.contourArea(c)
        chosen=min(ct,key=score)
        m=cv2.moments(chosen);cxy=[m['m10']/m['m00'],m['m01']/m['m00']]
        x,y,w,h=cv2.boundingRect(chosen)
        hull=cv2.convexHull(chosen);approx=cv2.approxPolyDP(hull,3,True)
        rect=cv2.boxPoints(cv2.minAreaRect(chosen)).tolist()
        roi=np.zeros(mask.shape,np.uint8);cv2.drawContours(roi,[chosen],-1,255,-1)
        ent.update({'centroid':cxy,'distanceFromPrevious':float(np.linalg.norm(np.array(cxy)-prev)),'bbox':[x,y,w,h],'area':float(cv2.contourArea(chosen)),
            'hull':hull[:,0].tolist(),'approx':approx[:,0].tolist(),'minAreaRect':rect,
            'limePixels':int(np.count_nonzero(cv2.bitwise_and(lime,roi))),'magentaPixels':int(np.count_nonzero(cv2.bitwise_and(magenta,roi)))})
        prev=np.array(cxy);cx,cy=int(cxy[0]),int(cxy[1])
    else:
        cx,cy=int(prev[0]),int(prev[1])
    entries.append(ent)
    x0=max(0,min(1920-400,cx-200));y0=max(0,min(1080-300,cy-150))
    crop=im[y0:y0+300,x0:x0+400].copy();shift=np.array([x0,y0])
    if chosen is not None:
        cv2.polylines(crop,[hull-shift],True,(255,100,0),1)
        for pt in approx[:,0]:cv2.circle(crop,tuple(pt-shift),3,(0,0,255),1)
    pil=Image.fromarray(cv2.cvtColor(crop,cv2.COLOR_BGR2RGB));tile=Image.new('RGB',(400,340),'#111');tile.paste(pil,(0,25))
    d=ImageDraw.Draw(tile);d.text((5,5),f'{n:02} ({n/24:.3f}s) offset {shift.tolist()} contours {len(ct)}','white')
    d.text((5,323),f'approx {ent.get("approx","-")}'[:70],'white')
    frames.append(tile)
for s in range(0,97,20):
    out=Image.new('RGB',(1600,340*5),'black')
    for i,t in enumerate(frames[s:s+20]):out.paste(t,((i%4)*400,(i//4)*340))
    out.save(P/f'raw-sheet-{s:02}.jpg',quality=92)
(P/'contour-observations.json').write_text(json.dumps(entries,indent=1))
print(json.dumps([{k:e.get(k) for k in ('frame','contours','bbox','area','limePixels','magentaPixels','distanceFromPrevious','approx')} for e in entries],indent=None))
