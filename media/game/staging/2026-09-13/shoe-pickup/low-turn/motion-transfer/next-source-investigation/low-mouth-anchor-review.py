import sys,pathlib,json,hashlib
sys.path.insert(0,'/tmp/astrid-optical-flow');import cv2,numpy as np
from PIL import Image,ImageDraw
cv2.setNumThreads(1)
p=pathlib.Path('/Users/solvifyab/Desktop/croupier/content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/next-source-investigation');s=cv2.imread(str(p/'box1-native00-ffmpeg.png'));a=cv2.imread(str(p/'low-mouth-anchor.png'));small=cv2.resize(a,(1920,1086));mask=np.zeros((1080,1920),np.uint8);mask[:450,:750]=255;mask[:450,1250:]=255
sift=cv2.SIFT_create();k1,d1=sift.detectAndCompute(s,mask);k2,d2=sift.detectAndCompute(small,None);m=cv2.BFMatcher().knnMatch(d1,d2,k=2);good=[x for x,y in m if x.distance<.7*y.distance];x=np.array([k2[z.trainIdx].pt for z in good],np.float32);y=np.array([k1[z.queryIdx].pt for z in good],np.float32);M,ins=cv2.estimateAffinePartial2D(x,y,method=cv2.RANSAC,ransacReprojThreshold=2);out=cv2.warpAffine(small,M,(1920,1080));res=np.linalg.norm(cv2.transform(x[:,None,:],M)[:,0]-y,axis=1);count=int(ins.sum())
review=Image.new('RGB',(1200,700))
for j,img in enumerate([s,out]):
 im=Image.fromarray(cv2.cvtColor(img,cv2.COLOR_BGR2RGB));review.paste(im.crop((1090,460,1390,710)).resize((600,500)),(j*600,0));review.paste(im.crop((880,80,1080,280)).resize((200,200)),(j*600,500))
review.save(p/'low-mouth-anchor-source-comparison.jpg',quality=95)
(p/'low-mouth-anchor-registration.json').write_text(json.dumps({'status':'analysis-only uniform registration, not approved','rawSize':[a.shape[1],a.shape[0]],'analysisResize':[1920,1086],'analysisSimilarity':M.tolist(),'backgroundSIFTinliers':count,'backgroundMedianResidualPx':float(np.median(res[ins[:,0]>0])),'outputSHA256':hashlib.sha256((p/'low-mouth-anchor.png').read_bytes()).hexdigest()},indent=2)+'\n')
print(M,count,np.median(res[ins[:,0]>0]))
