import pathlib
exec(open(pathlib.Path(__file__).with_name('inventory-audit.py')).read().split('rows=[]')[0])
cv2.setNumThreads(1)
def get(p,n):
 c=cv2.VideoCapture(str(r/p));c.set(0 if False else cv2.CAP_PROP_POS_FRAMES,n);ok,x=c.read();c.release();assert ok;return cv2.resize(x[:1080] if x.shape[0]==2160 else x,(1920,1080))
contact=files[0][1];centre=files[1][1]
a=get(contact,144); samples=[('contact144',a),('contact0',get(contact,0)),('centre0',get(centre,0)),('centre23',get(centre,23)),('centre24',get(centre,24)),('poseflow23',get('content/staging/2026-09-09/centre-pose-flow/source.mp4',23))]
s=Image.new('RGB',(1800,900));d=ImageDraw.Draw(s)
for i,(name,x) in enumerate(samples):
 crop=x[230:800,650:1320];im=Image.fromarray(cv2.cvtColor(crop,cv2.COLOR_BGR2RGB));im.thumbnail((590,420));xx=i%3*600;yy=i//3*450;s.paste(im,(xx,yy+22));d.text((xx,yy),name,fill='white')
s.save(o/'exact-bridge.jpg',quality=95)
metrics={}
for name,x in samples[1:]:
 metrics[name]={}
 for roi,(x0,y0,x1,y1) in {'face':(865,275,1020,440),'hands':(840,520,1200,715),'body':(750,430,1210,730)}.items():
  u=a[y0:y1,x0:x1].astype(float);v=x[y0:y1,x0:x1].astype(float);metrics[name][roi+'RGB_MAE']=float(abs(u-v).mean())
metrics['centre24_vs_contact0_MAE']=float(abs(samples[4][1].astype(float)-samples[1][1]).mean())
(o/'raw-comparison.json').write_text(json.dumps(metrics,indent=2));print(metrics)
s=Image.new('RGB',(1920,1080))
for i,n in enumerate([72,73,74,91,92,93]):
 x=get(contact,n);im=Image.fromarray(cv2.cvtColor(x[650:920,840:1100],cv2.COLOR_BGR2RGB)).resize((520,540));xx=i%3*640;yy=i//3*540;s.paste(im,(xx,yy));ImageDraw.Draw(s).text((xx,yy),f'n{n}',fill='red')
s.save(o/'hold-release.jpg',quality=95)
# native endpoint full face/hands with sparse optical flow displacement, background not warped
rows=[]
for name,x,y in [('end144_to_contact0',a,get(contact,0)),('end144_to_centre0',a,get(centre,0)),('centre23_to_contact0',get(centre,23),get(contact,0)),('hold74_to_release93',get(contact,74),get(contact,93))]:
 row={'pair':name,'patches':{}}
 for roi,(x0,y0,x1,y1) in {'face':(840,65,1055,265),'foldedHands':(820,425,1140,555),'deliveryHand':(890,730,1060,840)}.items():
  u=cv2.cvtColor(x[y0:y1,x0:x1],cv2.COLOR_BGR2GRAY);v=cv2.cvtColor(y[y0:y1,x0:x1],cv2.COLOR_BGR2GRAY)
  pts=cv2.goodFeaturesToTrack(u,50,.02,8)
  q,st,err=cv2.calcOpticalFlowPyrLK(u,v,pts,None,winSize=(25,25),maxLevel=3)
  good=(st[:,0]>0)&(err[:,0]<25);dd=q[good,0]-pts[good,0]
  row['patches'][roi]={'trackedFeatures':len(dd),'medianDisplacement':np.median(dd,axis=0).tolist(),'medianMagnitude':float(np.median(np.linalg.norm(dd,axis=1))),'p90Magnitude':float(np.percentile(np.linalg.norm(dd,axis=1),90))}
 rows.append(row)
(o/'pose-displacements.json').write_text(json.dumps(rows,indent=2));print(rows)
