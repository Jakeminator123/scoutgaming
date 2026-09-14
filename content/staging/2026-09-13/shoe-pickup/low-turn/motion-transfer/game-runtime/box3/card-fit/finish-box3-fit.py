from pathlib import Path
exec((Path(__file__).parent/'box3-plane-fit.py').read_text().split('rows=[]')[0])
j=json.load(open(o/'keypose-fixed-plane.json'));rows=j['records'];prev=rows[0]['theta']
for row in rows:
 theta=row['theta']
 while theta<prev-.5:theta+=np.pi
 row['theta']=float(theta);row['corners']=quad([theta,*row['center']]).tolist();row['correspondenceNote']='material corner order preserved by continuous in-plane rotation; opposite corner indices may differ from raw independentfit';prev=theta
for n,point in [(38,[1255,640]),(45,[1230,661])]:
 theta=rows[0]['theta'];shift=np.array(point)-quad([theta,0,0])[2];rows.append({'frame':n,'theta':theta,'center':shift.tolist(),'corners':quad([theta,*shift]).tolist(),'observedLeadingCornerEstimate':point,'observationUncertaintyPixels':4 if n==38 else 3,'hiddenCorners':'all rear corners inferred using native49 orientation and fixed plane; mouth silhouette must occlude card','status':'inferred extraction keypose only; no measured fullpaper shape'})
rows.sort(key=lambda x:x['frame']);j['records']=rows;j['orientation']='continuous0.84→3.139radian in-plane rotation; no normalflip';j['feasibility']='paper replacement plausible using original visible finger foreground; mask/pose integration remains unreviewed';j['sourceSHA256']='fdc1edca5671b88ccee6906746614c15b1e2b26bdabc83342b8505e0c97272c9';(o/'keypose-fixed-plane.json').write_text(json.dumps(j,indent=2))
c=cv2.VideoCapture(str(r/'content/staging/2026-09-09/contact-proof/source.mp4'));sheet=Image.new('RGB',(1920,1440),(20,20,20))
for k,row in enumerate(rows):
 n=row['frame'];c.set(cv2.CAP_PROP_POS_FRAMES,n);ok,x=c.read();im=Image.fromarray(cv2.cvtColor(x,cv2.COLOR_BGR2RGB));d=ImageDraw.Draw(im);q=[tuple(z) for z in row['corners']];d.line(q+[q[0]],fill='cyan',width=2)
 for a,b in zip(q,q[1:]+q[:1]):pass
 pts=row.get('observedCorners',{}).values() if n>=49 else [row['observedLeadingCornerEstimate']]
 for pt in pts:d.ellipse((pt[0]-3,pt[1]-3,pt[0]+3,pt[1]+3),fill='red')
 crop=im.crop((880,570,1360,900)).resize((640,440));sheet.paste(crop,((k%3)*640,(k//3)*480+20));ImageDraw.Draw(sheet).text(((k%3)*640,(k//3)*480),f'native{n} '+('hidden shape INFERRED' if n<49 else 'fixed basis; source unchanged'),fill='white');crop.save(o/f'fit-{n:03}.jpg',quality=94)
sheet.save(o/'eight-keypose-proof.jpg',quality=94)
(o/'ASSESSMENT.md').write_text('''# Fixed-card feasibility: existing contact-proof source

Source1920x1080 RGB preserved. No skin edits, no body retarget, no new credits. Keyframe wireframes assess geometry only; they are not final masked composites or gameplay approval.

One fixed affine card basis is derived from the native94 rounded-corner estimate. Local63x88 coordinates are normalized logical units, not measured metric calibration. Only translation and in-plane rotation vary. Constant basis does not model a physically calibrated camera or prove planarity; it tests whether a rigid-looking replacement fits without pursuing generated shape changes.

Native49/57 maximum observed-corner residuals6.996/7.217px;72/84/91/92 residuals2.435/1.352/1.519/1.519px. The early residual exceeds nominal3px observation uncertainty: likely source geometry/constant-affine approximation error. It is visible and must not be hidden by claiming exact tracking. Replacement covers most source paper and remains beneath the original fingertip pads. A bounded source paper mask and original hand foreground can plausibly replace it without moving anatomy, but edge coverage needs actual compositing review.

Native38 leading-edge end approximately[1255,640] ±4px;45 leading exposed corner[1230,661] ±3px. Their fullcard shapes are explicitly INFERRED from native49 orientation and fixed dimensions. Most rear paper lies inside the shoe. Fullquad must be occluded by the original shoe, not painted over it. Source38 paper is dark/thin and colour segmentation mostly detects shoe/lettering; contour-candidates.json is diagnostic and must NOT become erasure masks.

Material corner order uses a continuous in-plane orientation from0.841radian at49 to1.552 at57 to2.888 at72 and3.139 by91. The raw independent fit had a180degree symmetric branch; the saved sequence unwraps it. There is NO front/back turnover or allowed face swap. A server-issued card can supply the same visible surface throughout this action; a claimed flip is unsupported.

Records are bounded eight-keypose proposals at38,45,49,57,72,84,91,92. Intermediate frames are deliberately not labeled measured or runtime-ready. Native49–91 was previously visually inspected densely, but a complete fitted intermediate trajectory and final source-alpha/finger review remain necessary. If deriving intermediate poses, track observed straight edges and preserve this orientation branch; do not use arbitrary min-area boxes or interpolate through an unobserved flip.

Evidence eight-keypose-proof.jpg and individualfit images shows originalRGB beneath cyan proposed quad, red source corner observations. Extraction38/45 observations are partly hidden;49 leftcorner hidden behind fingers;57 upperlefthidden;72 onward near-complete outline apart from pads. Original source0/end144 and release proof remain under existing-continuation-search/extended. Candidate remains a low extraction→slide→empty return improvement with a long hold and absent turnover, not the entire requested dealer behaviour.
''')
