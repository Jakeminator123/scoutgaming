from pathlib import Path
import subprocess,json,sys,hashlib
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2
p=Path(__file__).resolve().parent;base=p.parent.parent;w,h=1924,1076
# Decode only needed source frames; original film pixels remain the actor source.
def decode(path,count):
    proc=subprocess.Popen(['ffmpeg','-v','error','-i',str(path),'-frames:v',str(count),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
    result=[]
    for n in range(count):
        raw=proc.stdout.read(w*h*3);assert len(raw)==w*h*3
        result.append(np.frombuffer(raw,np.uint8).reshape(h,w,3).copy())
    assert proc.wait()==0;return result
original=decode(base/'empty-return.mp4',73);clean=decode(p/'empty-return-clean-diagnostic.mp4',73);nextframes=decode(base/'extract-edge.mp4',25)
# A real source-card crop is a PLACEHOLDER ONLY, not authoritative game artwork.
source=original[72];roi=source[760:900,880:1030];mask=((roi[:,:,0]>160)&(roi[:,:,1]>155)&(roi[:,:,2]>140)).astype(np.uint8)*255
contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);contour=max(contours,key=cv2.contourArea)
hull=cv2.convexHull(contour);alpha=np.zeros(mask.shape,np.uint8);cv2.fillConvexPoly(alpha,hull,255)
ys,xs=np.where(alpha>0);left,top,right,bottom=xs.min(),ys.min(),xs.max()+1,ys.max()+1
rgba=np.dstack([roi[top:bottom,left:right],alpha[top:bottom,left:right]])
Image.fromarray(rgba).save(p/'frozen-source-Q-placeholder.png')
# Fixed table position for the complete return and next extraction.
px,py=880+left,775;cw,ch=rgba.shape[1],rgba.shape[0]
writer=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{w}x{h}','-r','24','-i','-','-an','-c:v','libx264','-crf','16','-bf','0','-pix_fmt','yuv420p',str(p/'persistent-card-return-next-extraction.mp4')],stdin=subprocess.PIPE)
tiles=[];stillhashes=[]
for n,film in enumerate(clean+nextframes):
    out=film.copy();a=rgba[:,:,3:4].astype(np.float32)/255
    out[py:py+ch,px:px+cw]=np.rint(rgba[:,:,:3]*a+out[py:py+ch,px:px+cw]*(1-a)).astype(np.uint8)
    if n<73:
        # Copy actual observed skin ABOVE paper. Same conservative classification
        # as cleanup; do not infer hidden anatomy or synthesize a hand edge.
        src=original[n];crop=src[710:795,850:953];r,g,b=[crop[:,:,k].astype(np.int16) for k in range(3)]
        skin=((r-g>22)&(r-b>35)&(r>85)&(g>45)).astype(np.uint8)
        count,labels,stats,centers=cv2.connectedComponentsWithStats(skin,8);keep=np.zeros_like(skin)
        for k in range(1,count):
            yy,xx=np.where(labels==k)
            if len(yy)>15 and yy.min()<45:keep[labels==k]=1
        target=out[710:795,850:953];target[keep>0]=crop[keep>0]
    # Card content and location stay identical whenever no fingertip overlaps.
    if n>=30:stillhashes.append(hashlib.sha256(out[py:py+ch,px:px+cw][rgba[:,:,3]>0].tobytes()).hexdigest())
    im=Image.fromarray(out);draw=ImageDraw.Draw(im);draw.text((20,20),'STAGING: FROZEN SOURCE Q PLACEHOLDER / NOT GAME ART OR APPROVED CONTACT',fill='white')
    writer.stdin.write(np.asarray(im).tobytes())
    if n in list(range(0,24))+[30,60,70,71,72,73,74,75,76,80,90,97]:
        tile=Image.new('RGB',(660,300),'#171717');tile.paste(Image.fromarray(film).crop((840,720,1060,905)).resize((330,278)),(0,0));tile.paste(Image.fromarray(out).crop((840,720,1060,905)).resize((330,278)),(330,0))
        ImageDraw.Draw(tile).text((8,282),f'n{n} {"return" if n<73 else "next extraction"} | CLEAN ONLY / FIXED SOURCE Q',fill='white');tiles.append(tile)
writer.stdin.close();assert writer.wait()==0
assert len(set(stillhashes))==1,'Persistent card changed across next extraction'
for batch in range((len(tiles)+11)//12):
    sheet=Image.new('RGB',(1980,1200),'#171717')
    for j,tile in enumerate(tiles[batch*12:(batch+1)*12]):sheet.paste(tile,(j%3*660,j//3*300))
    sheet.save(p/f'persistence-review-{batch}.jpg',quality=94)
(p/'persistence-receipt.json').write_text(json.dumps({'status':'staging-source-crop-placeholder-not-authoritative-game-art','source':'empty-return.mp4 frame72','fixedLocation':[int(v) for v in [px,py,cw,ch]],'returnFrames':73,'nextExtractionFrames':25,'outputFps':24,'cardPixelsIdenticalAfterFingerClear':len(set(stillhashes))==1,'sourceHashes':{f:hashlib.sha256((base/f).read_bytes()).hexdigest() for f in ['empty-return.mp4','extract-edge.mp4']}},indent=2)+'\n')
