from pathlib import Path
import sys,json
import numpy as np
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2
p=Path(__file__).resolve().parent;m=json.loads((p/'manifest.json').read_text());cap=cv2.VideoCapture(str(p/'cycle-shared60-packed-420.mp4'));want={0,73,74,75,76,139,140,141,142,180};rows=[];n=0
while True:
 ok,a=cap.read()
 if not ok:break
 if n in want:
  row=m['frames'][n];src=cv2.imread(str(p/'frames'/f'{n:04d}.png'));ref=src[:,1920:];rg=a[:,1920:];fg=ref[:,:,1]>128;fg2=rg[:,:,1]>128;actor=ref[:,:,2]>240
  d=np.abs(a[:,:1920].astype(float)-src[:,:1920]);rows.append({'frame':n,'clip':row['clip'],'local':row['localFrame'],'RGB_MAE_actorInterior':float(d[actor].mean()),'RG_MAE':np.abs(rg.astype(float)-ref).mean((0,1))[::-1].tolist(),'G_threshold128_IoU':float((fg&fg2).sum()/max(1,(fg|fg2).sum())),'G_threshold128_changedPixels':int((fg!=fg2).sum())})
  cv2.imwrite(str(p/f'boundary-{n:03d}.jpg'),np.concatenate([src[490:860,890:1300],a[490:860,890:1300],ref[490:860,890:1300],rg[490:860,890:1300]],1))
 n+=1
cap.release();assert n==181;(p/'boundary-check.json').write_text(json.dumps({'decodedFrames':n,'status':'encoding correspondence, not motion-seam approval','sourcePNGInputsUnchanged':True,'rows':rows},indent=2)+'\n');print(rows)
