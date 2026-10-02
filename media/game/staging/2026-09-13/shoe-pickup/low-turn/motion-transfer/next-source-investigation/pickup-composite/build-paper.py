exec(open(__file__.replace('build-paper.py','build.py')).read().split("out=here/")[0])
# Source-visible narrow paper strip; hidden corners are not inferred card geometry.
anchors={30:[[1240,622],[1256,627],[1256,629],[1240,624]],36:[[1234,623],[1258,631],[1258,633],[1234,625]],42:[[1227,624],[1259,635],[1259,638],[1227,628]],48:[[1215,624],[1259,640],[1259,644],[1215,632]],54:[[1207,624],[1260,641],[1257,647],[1207,635]],60:[[1200,621],[1259,641],[1251,652],[1196,635]],66:[[1200,620],[1259,641],[1240,655],[1191,637]],72:[[1201,620],[1259,641],[1237,656],[1189,638]]}
def paper(n):
 m=np.zeros((1080,1920),np.uint8)
 if n<30:return m,None
 keys=sorted(anchors);lo=max(k for k in keys if k<=n);hi=min(k for k in keys if k>=n);t=0 if hi==lo else(n-lo)/(hi-lo);q=np.array(anchors[lo])*(1-t)+np.array(anchors[hi])*t
 cv2.fillPoly(m,[np.rint(q).astype(np.int32)],255)
 # Include the observed white antialiased border and contact blur, retaining source RGB.
 return cv2.GaussianBlur(cv2.dilate(m,np.ones((5,5),np.uint8)),(5,5),.7),q.tolist()
procs=[]
for fps in [60,24]:
 p=subprocess.Popen(['/opt/homebrew/bin/ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','bgr24','-s','1920x1080','-r',str(fps),'-i','-','-an','-c:v','libx264','-threads','1','-preset','fast','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',str(here/f'pickup-paper-retained{fps}.mp4')],stdin=subprocess.PIPE);procs.append(p)
full=[];close=[];rows=[]
for row in receipt['frames']:
 n=row['sourceNative'];cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,a=cap.read();assert ok
 rg=cv2.imread(str(clean/row['file']));hand=rg[:,:,2]/255;front=rg[:,:,1]/255
 pm,q=paper(n);pa=pm/255
 # Original photographed paper beneath original foreground hand. No texture/pose invention.
 base=a*(1-patch[:,:,None])+registered*patch[:,:,None]
 base=a*pa[:,:,None]+base*(1-pa[:,:,None])
 local=hand*patch;result=(a*local[:,:,None]+base*(1-local[:,:,None])).clip(0,255).astype('uint8')
 for p in procs:p.stdin.write(result.tobytes())
 crops=[]
 for im in [a,result]:crops.append(cv2.resize(im[580:685,1130:1290],(480,315)))
 tile=np.concatenate(crops,axis=1);cv2.putText(tile,f'n{n}: source | shoe restored + original paper',(8,22),0,.6,(0,255,255),1);close.append(tile)
 if n in [0,18,36,54,72]:
  small=cv2.resize(result,(768,432));cv2.putText(small,f'n{n} ORIGINAL PAPER / PARTIAL EXTRACTION',(8,24),0,.55,(0,255,255),1);full.append(small)
 rows.append({'outputFrame':row['outputFrame'],'sourceNative':n,'sourcePTS':n/24,'paperPolygon':q,'paperBoundary':'Manual source-visible strip bounds; intermediate three-frame bounds interpolated; +/-2px blur uncertainty; not measured hidden corners','maskSHA256':row['sha256']})
for p in procs:p.stdin.close();assert p.wait()==0
cv2.imwrite(str(here/'paper-keyframes.jpg'),np.concatenate(full))
for k in range(5):cv2.imwrite(str(here/f'paper-close-{k}.jpg'),np.concatenate(close[k*5:k*5+5]))
meta={'status':'SOURCE PAPER temporal comparison, not authoritative game card or complete extraction','sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'backgroundSHA256':hashlib.sha256(background.read_bytes()).hexdigest(),'cleanMaskManifest':receipt['manifestSHA256'],'backgroundToSource0Similarity':M.tolist(),'registrationInliers':int(v.sum()),'registrationMedianErrorPx':float(np.median(error[v])),'actorTransform':'identity; original1920x1080 pixels, no body scaling/warping','compositing':'Local original source40 shoe/table background, original photographed paper inside reviewed visible strip, cleaned original hand above. Current original frame unchanged outside patch. RGB assets unchanged; only new authored composite encoded.','limits':['Native0-27 no confidently separated visible paper; 30-45 white thin edge ambiguous +/-2px.','Paper boundary masks are manual approximate with interpolation, not card geometry tracking.','No invented paper motion; every displayed paper RGB comes from matching original native frame.','Source-generated shoe mouth differs from restored physical shoe; overlap remains a visual hypothesis.','Final native72 remains partial extraction: no turnover, delivery, release or idle continuation.','60 and24fps outputs contain same25frames, no interpolation; neither proves actual displayed60fps.','Ordinary lossy H264CRF16 export.'],'rows':rows,'outputs':{f'pickup-paper-retained{fps}.mp4':hashlib.sha256((here/f'pickup-paper-retained{fps}.mp4').read_bytes()).hexdigest() for fps in [60,24]}}
(here/'paper-receipt.json').write_text(json.dumps(meta,indent=2));print('completed',meta['registrationMedianErrorPx'])
