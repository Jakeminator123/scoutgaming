from pathlib import Path
import subprocess,json,hashlib,sys
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2
root=Path(__file__).resolve().parent;src=root.parent.parent/'empty-return.mp4'
w,h=1924,1076
# Fixed destination and donor coordinates on the same stationary felt plane.
# This is a spatial clone of actual visible pixels, NOT recovered hidden texture.
x0,y0,x1,y1=890,766,1016,895;offset=170
reader=subprocess.Popen(['ffmpeg','-v','error','-i',str(src),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
writer=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{w}x{h}','-r','24','-i','-','-an','-c:v','libx264','-crf','16','-bf','0','-pix_fmt','yuv420p',str(root/'empty-return-clean-diagnostic.mp4')],stdin=subprocess.PIPE)
Y,X=np.mgrid[y0:y1,x0:x1];edge=np.minimum.reduce([X-x0,x1-1-X,Y-y0,y1-1-Y]);blend=np.clip(edge/6,0,1).astype(np.float32)
frames=[];maxfinger=[]
for n in range(73):
    raw=reader.stdout.read(w*h*3)
    assert len(raw)==w*h*3
    frame=np.frombuffer(raw,np.uint8).reshape(h,w,3).copy();out=frame.copy()
    # Warm skin connected to observed hand above card, bounded to the inspected
    # fingertip overlap zone. The art is never used as a hand/anatomy source.
    crop=frame[710:795,850:953];r,g,b=[crop[:,:,k].astype(np.int16) for k in range(3)]
    skin=((r-g>22)&(r-b>35)&(r>85)&(g>45)).astype(np.uint8)
    count,labels,stats,centers=cv2.connectedComponentsWithStats(skin,8)
    keep=np.zeros_like(skin)
    for k in range(1,count):
        ys,xs=np.where(labels==k)
        if len(ys)>15 and ys.min()<45:keep[labels==k]=1
    # Restore confident original skin RGB only. Mixed edge pixels remain a
    # manual matte review boundary; never dilate into white source paper.
    # No dilation: it copied a fringe of white card into the first diagnostic.
    preserve=np.zeros((h,w),np.uint8);preserve[710:795,850:953]=keep
    alpha=blend*(1-preserve[y0:y1,x0:x1])
    donor=frame[y0:y1,x0+offset:x1+offset]
    out[y0:y1,x0:x1]=np.rint(frame[y0:y1,x0:x1]*(1-alpha[:,:,None])+donor*alpha[:,:,None]).astype(np.uint8)
    assert np.array_equal(out[preserve>0],frame[preserve>0])
    writer.stdin.write(out.tobytes())
    # Every native frame is preserved in an indexed before/after sheet.
    left=Image.fromarray(frame).crop((840,720,1060,905)).resize((330,278));right=Image.fromarray(out).crop((840,720,1060,905)).resize((330,278))
    tile=Image.new('RGB',(660,300),'#171717');tile.paste(left,(0,0));tile.paste(right,(330,0));ImageDraw.Draw(tile).text((8,282),f'n{n:02d} / {n/24:.3f}s   SOURCE | CLONED FELT + ORIGINAL FINGERS',fill='white');frames.append(tile)
    if n in [0,19,24,29,72]:Image.fromarray(out).save(root/f'after-{n:02d}.png')
writer.stdin.close();assert writer.wait()==0;assert reader.wait()==0
for batch in range(7):
    sheet=Image.new('RGB',(1980,1200),'#171717')
    for j,tile in enumerate(frames[batch*12:(batch+1)*12]):sheet.paste(tile,(j%3*660,j//3*300))
    sheet.save(root/f'before-after-{batch}.jpg',quality=94)
(root/'receipt.json').write_text(json.dumps({'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'frames':73,'fps':24,'destination':[x0,y0,x1,y1],'donorTranslation':[offset,0],'method':'same-frame spatial clone of nearby real felt, fixed pixel registration, connected original fingertip preservation','status':'diagnostic-not-approved','allPreservedFingerPixelsIdenticalBeforeEncode':True},indent=2)+'\n')
