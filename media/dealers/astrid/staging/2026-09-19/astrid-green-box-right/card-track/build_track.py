"""Track the green prop of a player-box take as a RIGID card of fixed size.

    /tmp/astrid-a9mask-env/bin/python build_track.py --take-dir <folder with mask/frames + take-config.json>

Kevin 2026-09-19: the replaced card must not change size. The card is treated
as a rigid rectangle whose apparent size is fixed to the landing (rest) pose;
per frame only position and in-plane rotation are solved by least squares
over whatever marker dots are visible (the four magenta dots stay visible
through the rest pose, including partly under the fingers). Where no dot is
usable the bright card body's min-area rectangle gives centre and heading;
where nothing is usable the pose is interpolated between the last and next
solved frames. Every such frame is flagged inferred. Corners are the dots
scaled outward around their centroid by one ratio measured on the rest frame.

The plane is treated as locally affine: the card travels within a small depth
band near the box, so its projected size varies little; the measured change
(apparent width per frame, measured versus rigid) is recorded in
apparent-width.png and README.md so the approximation is visible rather than
hidden. Inference is explicit; no gameplay edits and no source RGB change.
"""
import argparse
from pathlib import Path
import hashlib,json,cv2,numpy as np
from PIL import Image,ImageDraw
HERE=Path(__file__).resolve().parent
ap=argparse.ArgumentParser();ap.add_argument('--take-dir',type=Path,default=HERE.parent);args=ap.parse_args()
TAKE=args.take_dir.resolve();P=TAKE/'card-track';P.mkdir(exist_ok=True)
FRAMES=TAKE/'mask'/'frames';SOURCE=TAKE/'source.mp4'
CONFIG=json.loads((TAKE/'take-config.json').read_text());T=CONFIG['track']
N=len(sorted(FRAMES.glob('[0-9][0-9][0-9][0-9].png')))
EVENTS=T['events'];FACE_UP_FROM=T.get('faceUpFrom',0)
BODY_FRAMES=set(T.get('bodyFrames',[]));BODY_UNTIL=T.get('bodyUntilFrame',36)
INTERPOLATE=set(T.get('interpolateFrames',[]));RESIDUAL_GATE=T.get('residualGatePx',8)
SHOE=np.array(T['shoePolygon'],np.int32);START=np.array(T['startCentre'],float)
PHASES=T.get('phases',[[0,'before-pickup'],[EVENTS['pickup'],'contact'],[EVENTS['release'],'release'],[EVENTS['land'],'empty-return']])

def hsv_of(n):
    im=cv2.imread(str(FRAMES/f'{n:04}.png'));return im,cv2.cvtColor(im,cv2.COLOR_BGR2HSV)

def dots_in(hsv,centre,radius):
    m=cv2.inRange(hsv,np.array([135,90,60]),np.array([175,255,255]))
    m[:480]=0;m[:,:700]=0;m[:,1700:]=0
    num,labels,stats,cents=cv2.connectedComponentsWithStats(m,8)
    out=[]
    for i in range(1,num):
        a=stats[i,cv2.CC_STAT_AREA]
        if 4<=a<=220 and np.linalg.norm(cents[i]-centre)<=radius:out.append((cents[i].astype(float),int(a)))
    return out

def body_mask(hsv):
    lime=cv2.inRange(hsv,np.array([35,70,105]),np.array([57,255,255]))
    dark=cv2.inRange(hsv,np.array([57,110,150]),np.array([68,255,255]))
    shoe=np.zeros(hsv.shape[:2],np.uint8);cv2.fillPoly(shoe,[SHOE],255)
    shoe=cv2.dilate(shoe,np.ones((9,9),np.uint8))
    dark[shoe>0]=0
    m=cv2.bitwise_or(lime,dark);m[:480]=0;m[:,:700]=0;m[:,1700:]=0
    return m

def order_rest(dots):
    # far-left, far-right, near-right, near-left (UV 00,10,11,01): printed top toward Astrid, upright to the player.
    pts=sorted(dots,key=lambda p:p[1]);top=sorted(pts[:2],key=lambda p:p[0]);bot=sorted(pts[2:],key=lambda p:p[0])
    return [top[0],top[1],bot[1],bot[0]]

# Pass 1: per-frame evidence. Centre prior from the card body component nearest
# the previous centre (bright lime is reliable while the card is carried), then
# the magenta dots around that centre, plus the body rectangle when it is large.
raw={};bodies={};centre=START.copy()
for n in range(N):
    im,hsv=hsv_of(n)
    m=body_mask(hsv);num,labels,stats,cents=cv2.connectedComponentsWithStats(m,8)
    cand=[(np.linalg.norm(cents[i]-centre),i) for i in range(1,num) if stats[i,cv2.CC_STAT_AREA]>250]
    body=None
    if cand:
        d,i=min(cand)
        if d<120:
            centre=cents[i].astype(float)
            if stats[i,cv2.CC_STAT_AREA]>1500 and n<BODY_UNTIL:
                ys,xs=np.where(labels==i);body=cv2.boxPoints(cv2.minAreaRect(np.stack([xs,ys],1).astype(np.float32))).astype(float)
    found=dots_in(hsv,centre,110)
    if len(found)>=2:centre=np.mean([f[0] for f in found],0)
    raw[n]=found;bodies[n]=body

def cyclic_assign(prev,pts):
    best=None
    for s in range(4):
        cand=[pts[(i+s)%4] for i in range(4)];d=sum(np.linalg.norm(np.array(cand[i])-np.array(prev[i])) for i in range(4))
        if best is None or d<best[0]:best=(d,cand)
    return best[1]

# Pass 2 (correspondence only): match dots to material corners frame to frame, forward and backward,
# with parallelogram/rigid/body fallbacks purely to keep a running estimate for matching.
def track(sequence,initial):
    ordered={};visible={};method={};prev=initial;gap=0
    for n in sequence:
        dots=raw[n];assign=[None]*4;used=set()
        thr=70+30*gap
        pairs=sorted(((np.linalg.norm(d[0]-np.array(prev[i])),i,j) for i in range(4) for j,d in enumerate(dots)),key=lambda t:t[0])
        for dist,i,j in pairs:
            if assign[i] is None and j not in used and dist<thr:assign[i]=dots[j][0];used.add(j)
        vis=[i for i in range(4) if assign[i] is not None];q=None;how=None
        if n in BODY_FRAMES and bodies[n] is not None:q=cyclic_assign(prev,[p for p in bodies[n]]);vis=[];how='body-min-area-rect'
        elif len(vis)==4:q=assign;how='four-marker-dots'
        elif len(vis)==3:
            miss=[i for i in range(4) if assign[i] is None][0];q=list(assign);q[miss]=assign[(miss+1)%4]+assign[(miss+3)%4]-assign[(miss+2)%4];how='three-marker-dots-parallelogram-completion'
        elif len(vis)==2:
            i,j=vis;pv=np.array(prev[j])-np.array(prev[i]);nv=np.array(assign[j])-np.array(assign[i])
            ang=np.arctan2(nv[1],nv[0])-np.arctan2(pv[1],pv[0]);R=np.array([[np.cos(ang),-np.sin(ang)],[np.sin(ang),np.cos(ang)]])
            pm=(np.array(prev[i])+np.array(prev[j]))/2;nm=(np.array(assign[i])+np.array(assign[j]))/2
            q=[assign[k] if k in vis else (R@(np.array(p)-pm)+nm) for k,p in enumerate(prev)];how='two-marker-dots-rigid-transfer'
        if q is None and bodies[n] is not None:
            q=cyclic_assign(prev,[p for p in bodies[n]]);vis=[];how='body-min-area-rect'
        visible[n]=vis;method[n]=how
        if q is not None:prev=q;gap=0;ordered[n]=(q,{i:assign[i] for i in vis})
        else:gap+=1;ordered[n]=None
    return ordered,visible,method

last=N-1
rest=[d[0] for d in sorted(raw[last],key=lambda d:-d[1])[:4]];assert len(rest)==4,('rest frame needs four dots',raw[last])
first=[d[0] for d in sorted(raw[0],key=lambda d:-d[1])[:4]];assert len(first)==4,('first frame needs four dots',raw[0])
c0=np.mean(first,0);first=sorted(first,key=lambda p:np.arctan2(p[1]-c0[1],p[0]-c0[0]))
REST=order_rest(rest)
bwd=track(range(N-2,-1,-1),REST);fwd=track(range(1,N),first)
bwd[0][last]=(REST,{i:REST[i] for i in range(4)});bwd[1][last]=[0,1,2,3];bwd[2][last]='four-marker-dots'
fwd[0][0]=(first,{i:first[i] for i in range(4)});fwd[1][0]=[0,1,2,3];fwd[2][0]='four-marker-dots'
r=next(n for n in range(20,N) if len(bwd[1].get(n,[]))>=3 and len(fwd[1].get(n,[]))>=3)
shift=min(range(4),key=lambda s:sum(np.linalg.norm(np.array(fwd[0][r][0][(i+s)%4])-np.array(bwd[0][r][0][i])) for i in range(4)))
measured={};dots={};methods={}
for n in range(N):
    options=[]
    if bwd[0].get(n) is not None:options.append((len(bwd[1][n]),1 if n>=r else 0,bwd[0][n][0],dict(bwd[0][n][1]),bwd[2][n]))
    if fwd[0].get(n) is not None:
        q,d=fwd[0][n];options.append((len(fwd[1][n]),0 if n>=r else 1,[q[(i+shift)%4] for i in range(4)],{(i-shift)%4:p for i,p in d.items()},fwd[2][n]))
    if options:
        best=max(options,key=lambda o:(o[0],o[1]));measured[n],dots[n],methods[n]=best[2],best[3],best[4]
    else:measured[n]=None;dots[n]={};methods[n]='interpolated-between-tracked-neighbours'
RECONCILE=dict(frame=r,cyclicShift=shift)

# Reference rigid shape: rest-frame dots and their outward corner ratio, measured on the rest body.
ref_dots=np.array(REST,float);ref_c=ref_dots.mean(0)
m=body_mask(hsv_of(last)[1]);num,labels,stats,cents=cv2.connectedComponentsWithStats(m,8)
lab=labels[int(round(ref_c[1])),int(round(ref_c[0]))];assert lab>0,'rest card body not found under its dots'
ys,xs=np.where(labels==lab);rect=cv2.boxPoints(cv2.minAreaRect(np.stack([xs,ys],1).astype(np.float32)));rc=rect.mean(0)
K=float(np.mean([np.linalg.norm(p-rc) for p in rect])/np.mean([np.linalg.norm(p-ref_c) for p in ref_dots]))
ref_corners=ref_c+(ref_dots-ref_c)*K
ref_local=ref_dots-ref_c;ref_corner_local=ref_corners-ref_c

def rot(theta):return np.array([[np.cos(theta),-np.sin(theta)],[np.sin(theta),np.cos(theta)]])
def procrustes_rigid(src,dst):
    """Rotation + translation (no scale) least squares from src (k x 2) to dst (k x 2)."""
    sc=src.mean(0);dc=dst.mean(0);a=src-sc;b=dst-dc
    h=a.T@b;theta=np.arctan2(h[0,1]-h[1,0],h[0,0]+h[1,1])
    return theta,dc-rot(theta)@sc

# Pass 3: rigid pose per frame (theta unwrapped along time, translation of the card centre).
pose={};pose_method={};prev_theta=None
for n in range(N):
    d=dots[n];vis=sorted(d)
    if n in INTERPOLATE:pose[n]=None;pose_method[n]='interpolated-pose'
    elif len(vis)>=2:
        theta,t=procrustes_rigid(ref_local[vis],np.array([d[i] for i in vis]))
        pose[n]=(theta,t);pose_method[n]={4:'rigid-fit-four-dots',3:'rigid-fit-three-dots',2:'rigid-fit-two-dots'}[len(vis)]
    elif len(vis)==1 and prev_theta is not None:
        i=vis[0];theta=prev_theta;t=np.array(d[i])-rot(theta)@ref_local[i];pose[n]=(theta,t);pose_method[n]='translation-from-one-dot'
    elif bodies[n] is not None and measured[n] is not None and methods[n]=='body-min-area-rect':
        theta,t=procrustes_rigid(ref_corner_local,np.array(measured[n]));pose[n]=(theta,t);pose_method[n]='rigid-fit-body-rectangle'
    else:pose[n]=None;pose_method[n]='interpolated-pose'
    if pose[n] is not None:
        theta,t=pose[n]
        if prev_theta is not None:
            while theta-prev_theta>np.pi:theta-=2*np.pi
            while theta-prev_theta<-np.pi:theta+=2*np.pi
        pose[n]=(theta,t);prev_theta=theta
# Residual gate: a fit whose visible dots sit further than the gate from the rigid model is not trusted
# (a mismatched marker or a foreshortened, lifted card); its pose is interpolated instead and flagged.
for n in range(N):
    if pose[n] is None or not dots[n]:continue
    pred=(rot(pose[n][0])@ref_local.T).T+pose[n][1]
    res=float(np.mean([np.linalg.norm(pred[i]-np.array(p)) for i,p in dots[n].items()]))
    if res>RESIDUAL_GATE and n>=EVENTS['pickup']:pose[n]=None;pose_method[n]='interpolated-pose'
solved=[n for n in range(N) if pose[n] is not None]
for n in range(N):
    if pose[n] is None:
        lo=max([k for k in solved if k<n],default=None);hi=min([k for k in solved if k>n],default=None)
        if lo is None:pose[n]=pose[hi]
        elif hi is None:pose[n]=pose[lo]
        else:
            u=(n-lo)/(hi-lo);pose[n]=(pose[lo][0]*(1-u)+pose[hi][0]*u,pose[lo][1]*(1-u)+pose[hi][1]*u)
rigid={n:(rot(pose[n][0])@ref_corner_local.T).T+pose[n][1] for n in range(N)}
residual={}
for n in range(N):
    d=dots[n]
    if d:
        pred=(rot(pose[n][0])@ref_local.T).T+pose[n][1]
        residual[n]=float(np.mean([np.linalg.norm(pred[i]-np.array(p)) for i,p in d.items()]))
    else:residual[n]=None

def width_of(q):
    q=np.array(q,float);return float((np.linalg.norm(q[1]-q[0])+np.linalg.norm(q[2]-q[3]))/2)
def height_of(q):
    q=np.array(q,float);return float((np.linalg.norm(q[2]-q[1])+np.linalg.norm(q[3]-q[0]))/2)
measured_corner={}
for n in range(N):
    if measured[n] is None:measured_corner[n]=None;continue
    q=np.array(measured[n],float)
    if methods[n]=='body-min-area-rect':measured_corner[n]=q
    else:c=q.mean(0);measured_corner[n]=c+(q-c)*K
widths=[(n,width_of(measured_corner[n]) if measured_corner[n] is not None else None,width_of(rigid[n]),height_of(measured_corner[n]) if measured_corner[n] is not None else None,height_of(rigid[n])) for n in range(N)]

def phase_of(n):
    name=PHASES[0][1]
    for start,label in PHASES:
        if n>=start:name=label
    return name
conf_of={'rigid-fit-four-dots':.9,'rigid-fit-three-dots':.8,'rigid-fit-two-dots':.65,'translation-from-one-dot':.45,'rigid-fit-body-rectangle':.7,'interpolated-pose':.3}
frames=[]
for n in range(N):
    vis=sorted(dots[n]);pm=pose_method[n]
    inferred=[i for i in range(4) if i not in vis]
    frames.append(dict(frame=n,time=round(n/24,8),quad=[[round(float(x),1),round(float(y),1)] for x,y in rigid[n]],
        measuredQuad=None if measured_corner[n] is None else [[round(float(x),1),round(float(y),1)] for x,y in measured_corner[n]],
        pose={'thetaDeg':round(float(np.degrees(pose[n][0])),2),'centre':[round(float(v),1) for v in pose[n][1]]},
        dotsVisible=vis,method=pm,correspondenceMethod=methods[n],confidence=conf_of[pm],rigidResidualPx=None if residual[n] is None else round(residual[n],2),
        cornersSupportedByVisibleEvidence=vis,inferredCorners=inferred,phase=phase_of(n),handContact=T.get('handContactFrom',EVENTS['pickup'])<=n<EVENTS['release'],stationary=n>=T.get('stationaryFrom',EVENTS['release']),
        faceUp=n>=FACE_UP_FROM,faceUpProvenance='authored: identical green faces cannot prove the physical side; the game deals player cards face up',
        materialCorrespondence='marker dots matched frame to frame from the rest pose; order fixed as far-left, far-right, near-right, near-left at rest'))
(P/'annotated').mkdir(exist_ok=True)
tiles=[]
for f in frames:
    n=f['frame'];im=cv2.imread(str(FRAMES/f'{n:04}.png'))
    if f['measuredQuad']:cv2.polylines(im,[np.round(np.array(f['measuredQuad'],np.float32)).astype(np.int32)],True,(0,200,255),1,cv2.LINE_AA)
    q=np.array(f['quad'],np.float32);qi=np.round(q).astype(np.int32)
    cv2.polylines(im,[qi],True,(255,0,255),1,cv2.LINE_AA)
    for i,pt in enumerate(qi):
        color=(0,255,255) if i in f['inferredCorners'] else (255,255,0)
        cv2.circle(im,tuple(pt),3,color,-1);cv2.putText(im,str(i),tuple(pt+np.array([5,-5])),cv2.FONT_HERSHEY_SIMPLEX,.4,color,1,cv2.LINE_AA)
    cv2.putText(im,f'{n:02} {n/24:.3f}s {f["phase"]} {f["method"]} res {f["rigidResidualPx"]}',(15,30),cv2.FONT_HERSHEY_SIMPLEX,.7,(255,255,255),2,cv2.LINE_AA)
    cv2.imwrite(str(P/'annotated'/f'{n:03}.jpg'),im,[cv2.IMWRITE_JPEG_QUALITY,88])
    cx,cy=q.mean(0);x0=int(max(0,min(1520,cx-200)));y0=int(max(0,min(780,cy-150)))
    tile=Image.new('RGB',(400,335),'#111');tile.paste(Image.fromarray(cv2.cvtColor(im[y0:y0+300,x0:x0+400],cv2.COLOR_BGR2RGB)),(0,30))
    ImageDraw.Draw(tile).text((5,5),f'{n:02} {n/24:.3f}s {f["phase"]} {f["method"]} res {f["rigidResidualPx"]}',fill='white');tiles.append(tile)
for s in range(0,N,20):
    sheet=Image.new('RGB',(1600,1675),'#111')
    for i,tile in enumerate(tiles[s:s+20]):sheet.paste(tile,((i%4)*400,(i//4)*335))
    sheet.save(P/f'annotated-sheet-{s:02}.jpg',quality=90)
# Apparent width per frame, measured (orange) versus rigid (magenta): the size check Kevin asked for.
chart=Image.new('RGB',(1200,420),'#15181c');d=ImageDraw.Draw(chart)
allw=[w for _,mw,rw,_,_ in widths for w in (mw,rw) if w is not None];lo_w,hi_w=min(allw)*.9,max(allw)*1.05
X=lambda n:60+n*(1100/(N-1));Y=lambda w:380-(w-lo_w)/(hi_w-lo_w)*330
for g in range(int(lo_w),int(hi_w)+1,10):d.line([(60,Y(g)),(1160,Y(g))],fill='#2a2f36');d.text((8,Y(g)-6),f'{g}px',fill='#9aa')
for n in range(0,N,8):d.text((X(n)-6,392),str(n),fill='#9aa')
pts_m=[(X(n),Y(mw)) for n,mw,_,_,_ in widths if mw is not None];pts_r=[(X(n),Y(rw)) for n,_,rw,_,_ in widths]
d.line(pts_m,fill='#ffa030',width=2);d.line(pts_r,fill='#ff40ff',width=2)
for n,mw,rw,_,_ in widths:
    if pose_method[n]=='interpolated-pose':d.rectangle([X(n)-3,40,X(n)+3,48],fill='#66f')
d.text((70,12),'apparent card width per frame: orange = measured corners (previous tracker), magenta = rigid pose (fixed to the rest size); blue ticks = interpolated pose',fill='white')
chart.save(P/'apparent-width.png')
sha=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
assert sha==CONFIG['sourceSha256'],'source.mp4 differs from take-config.json'
events=dict(T.get('eventNotes',{}))
events.update({
 'replacementFirstDrawn':{'frame':EVENTS['pickup'],'seconds':EVENTS['pickup']/24,'note':'authored pickup: the replacement is first drawn once the card leaves the shoe mouth'},
 'fingerRelease':{'frame':EVENTS['release'],'seconds':EVENTS['release']/24,'uncertaintyFrames':1},
 'landCue':{'frame':EVENTS['land'],'seconds':EVENTS['land']/24,'note':f'authored {EVENTS["land"]-EVENTS["release"]} frame(s) after visible fingertip separation; the DOM card of box {CONFIG["box"]} takes over at the filmed quad'},
 'rest':{'frame':EVENTS['rest'],'seconds':EVENTS['rest']/24}})
mw=[w for _,w,_,_,_ in widths if w is not None];rw=[w for _,_,w,_,_ in widths]
result=dict(version=2,source=str(SOURCE.resolve()),sourceSha256=sha,jobId=CONFIG['jobId'],box=CONFIG['box'],width=1920,height=1080,fps=24,frameCount=N,
 coordinateSpace='native decoded source pixels; origin top-left; x right, y down',
 cornerOrder='fixed UV00,UV10,UV11,UV01 = far-left, far-right, near-right, near-left at rest; marker dots matched frame to frame; no per-frame screen sorting',
 model='rigid rectangle of fixed apparent size (rest pose); per-frame least-squares rotation + translation over visible marker dots; body rectangle or interpolated pose where no dot is usable',
 restReference={'dots':[[round(float(x),1),round(float(y),1)] for x,y in ref_dots],'corners':[[round(float(x),1),round(float(y),1)] for x,y in ref_corners],'dotToCornerRatio':K,
   'widthPx':width_of(ref_corners),'heightPx':height_of(ref_corners)},
 apparentWidth={'measuredMinMaxPx':[round(min(mw),1),round(max(mw),1)],'rigidMinMaxPx':[round(min(rw),1),round(max(rw),1)],'perFrame':[{'frame':n,'measured':None if a is None else round(a,1),'rigid':round(b,1),'measuredHeight':None if c is None else round(c,1),'rigidHeight':round(e,1)} for n,a,b,c,e in widths]},
 poseMethods={m:[n for n in range(N) if pose_method[n]==m] for m in set(pose_method.values())},orderReconciliation=RECONCILE,
 scope=f'first card to box {CONFIG["box"]} only',events=events,authoredEvents=EVENTS,frames=frames,
 limits=[
 'The card is a rigid rectangle of fixed apparent size (the rest pose): perspective foreshortening while the card is lifted or tilted during the carry is NOT reproduced; the measured corners (orange in apparent-width.png) show how much the source card actually changes.',
 'Per-frame pose is rotation + translation only, least squares over visible marker dots; two-dot and one-dot frames lean on the previous heading and are flagged inferredCorners.',
 'Frames with no usable dot use the bright body rectangle for centre and heading, or an interpolated pose; both are flagged.',
 'faceUp is authored: no edge-on turn is measured and identical green faces cannot prove the physical side.',
 'The filmed landing is kept: the DOM card of the box is registered to the landed quad, so the box fan sits where the hand left the card, not on the betting marker.',
 'The replacement is not drawn before the authored pickup frame; the filmed card protruding from the shoe before that is keyed out.',
 'These are source measurements, not rendered-gameplay acceptance.'])
(P/'card-track.json').write_text(json.dumps(result,indent=2)+'\n')
areas=[cv2.contourArea(np.array(f['quad'],np.float32),oriented=True) for f in frames]
assert all(a>0 for a in areas),[(i,a) for i,a in enumerate(areas) if a<=0]
assert all(cv2.isContourConvex(np.array(f['quad'],np.float32)) for f in frames),[f['frame'] for f in frames if not cv2.isContourConvex(np.array(f['quad'],np.float32))]
print(json.dumps({'frames':N,'K':K,'restWidth':width_of(ref_corners),'restHeight':height_of(ref_corners),'measuredWidthRange':result['apparentWidth']['measuredMinMaxPx'],'rigidWidthRange':result['apparentWidth']['rigidMinMaxPx'],
 'poseMethods':result['poseMethods'],'residualOver6Px':{n:frames[n]['rigidResidualPx'] for n in range(N) if frames[n]['rigidResidualPx'] is not None and frames[n]['rigidResidualPx']>6},'reconcile':RECONCILE,
 'restQuad':frames[last]['quad'],'releaseQuad':frames[EVENTS['release']]['quad'],'pickupQuad':frames[EVENTS['pickup']]['quad']}))
