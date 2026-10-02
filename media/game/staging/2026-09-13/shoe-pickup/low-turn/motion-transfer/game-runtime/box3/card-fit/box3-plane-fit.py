from pathlib import Path
exec((Path(__file__).parent/'box3-fit.py').read_text().split('c=cv2.VideoCapture')[0])
from scipy.optimize import least_squares
base=np.array([[-31.5,-44],[31.5,-44],[31.5,44],[-31.5,44]])
A=np.array([[66.5/63,5.5/88],[-2/63,65/88]])
obs={45:({'2':[1230,661]},None),49:({'0':[1208,626],'1':[1251,649],'2':[1188,695]},None),57:({'1':[1174,715],'2':[1183,753],'3':[1093,755]},None),72:({'0':[937,791],'1':[999,778],'2':[1031,841],'3':[964,853]},None),84:({'0':[926,788],'1':[990,786],'2':[998,851],'3':[930,854]},None),91:({'0':[926,789],'1':[990,786],'2':[998,851],'3':[929,853]},None),92:({'0':[926,789],'1':[990,786],'2':[998,851],'3':[929,853]},None)}
def quad(v):
 th,x,y=v;T=np.array([[np.cos(th),-np.sin(th)],[np.sin(th),np.cos(th)]]);return base@T.T@A.T+[x,y]
rows=[]
for n,(points,_) in obs.items():
 if n==45:continue
 best=None
 # Enumerate corner identities consistently: source observation list may start atdifferentprojectedcorner; choose lower absolute angle branch.
 for shift in range(4):
  inds=(np.array([int(k) for k in points])+shift)%4;pts=np.array(list(points.values()))
  for theta in [-1.5,-.7,0,.7,1.5]:
   fit=least_squares(lambda v:(quad(v)[inds]-pts).ravel(),[theta,*pts.mean(0)])
   rms=float(np.sqrt(np.mean((quad(fit.x)[inds]-pts)**2)))
   rank=rms+.0001*abs(fit.x[0])
   if best is None or rank<best[0]:best=(rank,fit.x,inds,rms)
 _,v,inds,rms=best;q=quad(v);rows.append({'frame':n,'theta':float(v[0]),'center':v[1:].tolist(),'corners':q.tolist(),'observedCorners':points,'assignedTemplateIndices':inds.tolist(),'rmsCoordinateResidual':rms,'maxCornerResidual':float(np.linalg.norm(q[inds]-np.array(list(points.values())),axis=1).max())})
 print(n,v,rms)
(o/'keypose-fixed-plane.json').write_text(json.dumps({'status':'feasibility only; keypose correspondences and affine plane inferred;63x88 normalized units not measured metric size','basis':A.tolist(),'records':rows},indent=2))
c=cv2.VideoCapture(str(r/'content/staging/2026-09-09/contact-proof/source.mp4'))
for row in rows:
 n=row['frame'];c.set(cv2.CAP_PROP_POS_FRAMES,n);ok,x=c.read();im=Image.fromarray(cv2.cvtColor(x,cv2.COLOR_BGR2RGB));d=ImageDraw.Draw(im);q=[tuple(z) for z in row['corners']];d.line(q+[q[0]],fill='cyan',width=2)
 for pt in row['observedCorners'].values():d.ellipse((pt[0]-3,pt[1]-3,pt[0]+3,pt[1]+3),fill='red')
 im.crop((880,570,1360,900)).resize((960,660)).save(o/f'fit-{n:03}.jpg',quality=95)
