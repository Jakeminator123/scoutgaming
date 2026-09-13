from pathlib import Path
import sys,json,hashlib
import numpy as np
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2
p=Path(__file__).resolve().parent
for c in sys.argv[1:]:
 a=cv2.VideoCapture(str(p/c/f'{c}-shared60-packed.mp4'));b=cv2.VideoCapture(str(p/c/f'{c}-shared60-packed-420.mp4'));rows=[];n=0
 while True:
  ok,x=a.read();ok2,y=b.read()
  if not ok or not ok2:break
  rg=x[:,1920:];rg2=y[:,1920:];R=rg[:,:,2]>128;R2=rg2[:,:,2]>128;G=rg[:,:,1]>128;G2=rg2[:,:,1]>128
  bound=cv2.dilate(G.astype(np.uint8),np.ones((5,5),np.uint8))-cv2.erode(G.astype(np.uint8),np.ones((5,5),np.uint8));edge=bound>0
  f=x[110:290,910:1050].astype(float);f2=y[110:290,910:1050].astype(float);face=(rg[110:290,910:1050,2]>250)
  rows.append({'frame':n,'R_threshold128_differencePixels':int((R!=R2).sum()),'G_threshold128_differencePixels':int((G!=G2).sum()),'G_positive444':int(G.sum()),'G_threshold128_IoU':float((G&G2).sum()/max(1,(G|G2).sum())),'G_edge_MAE':float(np.abs(rg[:,:,1].astype(float)-rg2[:,:,1])[edge].mean()) if edge.any() else 0,'G_edge_maxAbsolute':int(np.abs(rg[:,:,1].astype(int)-rg2[:,:,1])[edge].max()) if edge.any() else 0,'faceRGBmeanDelta420minus444':(f2-f)[face].mean(0)[::-1].tolist(),'faceRGB_MAE':float(np.abs(f2-f)[face].mean())})
  if n in [0,20,32,60]:
   cv2.imwrite(str(p/c/f'compare420-{n:02d}.png'),np.concatenate([x[490:850,900:1300],y[490:850,900:1300],rg[490:850,900:1300],rg2[490:850,900:1300]],axis=1))
  n+=1
 a.release();b.release()
 result={'status':'decoded420 vs decoded444; threshold comparisons not visual approval','framesCompared':n,'maxRdifferences':max(r['R_threshold128_differencePixels']for r in rows),'maxGdifferences':max(r['G_threshold128_differencePixels']for r in rows),'minimumGIoU':min(r['G_threshold128_IoU']for r in rows),'maximumFaceRGB_MAE':max(r['faceRGB_MAE']for r in rows),'rows':rows};(p/c/'compare420.json').write_text(json.dumps(result,indent=2)+'\n');print(c,{k:v for k,v in result.items()if k!='rows'})
