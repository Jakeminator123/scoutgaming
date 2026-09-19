"""Bounded fixed-physical-size fit of the face-up segment, not an install.

The turn itself remains untracked: no invented front/back evidence. This
diagnostic checks whether a rigid 72x103mm card can follow the visible prop
without scaling or implausible travel towards the camera.
"""
import json, math
from pathlib import Path
import cv2
import numpy as np
from scipy.optimize import least_squares
from PIL import Image, ImageDraw

D = Path(__file__).resolve().parent
T = json.loads((D/'target.json').read_text())
E = json.loads((D/'source-review/evidence.json').read_text())
P = np.array(T['camera']['projection']).reshape(4,4,order='F')
W = np.array(T['camera']['world']).reshape(4,4,order='F')
VP = P @ np.linalg.inv(W)
surface = T['quadWorld'][0][1]
w,h = T['cardSizeMetres']
corners = np.array([[-w/2,0,-h/2],[w/2,0,-h/2],[w/2,0,h/2],[-w/2,0,h/2]])
imageMap = np.array([[960,0,960],[0,-540,540],[0,0,1]])
H = imageMap @ VP[[0,1,3]][:,[0,2,3]]
H[:,2] += imageMap @ VP[[0,1,3],1] * surface
Hi = np.linalg.inv(H)
def table_point(point):
    p = Hi @ np.r_[point,1]
    return p[:2]/p[2]
def project(points):
    p = np.c_[points,np.ones(len(points))] @ VP.T
    return np.c_[(p[:,0]/p[:,3]+1)*960, (1-p[:,1]/p[:,3])*540]
def world(p,local):
    return local @ cv2.Rodrigues(np.asarray(p[3:]))[0].T + [p[0],surface+p[2],p[1]]

# Calibrate material marker offsets ONCE from the end frame and the approved
# physical card quad. Generated dots are nearer the border than requested.
quad_world = np.array(T['quadWorld'])
centre = quad_world.mean(0)
ex = (quad_world[1]-quad_world[0])/w
ez = (quad_world[3]-quad_world[0])/h
rest = E['frames'][-1]
names = ['magenta','yellow','cyan','white']
restDots = []
for i,name in enumerate(names):
    c = min(rest['markerCandidates'][name],key=lambda c:np.linalg.norm(np.array(c['centre'])-T['quadSource'][i]))
    restDots.append(c['centre'])
marker_world = np.array([[*table_point(p)[:1], surface, table_point(p)[1]] for p in restDots])
markers = np.c_[(marker_world-centre)@ex,np.zeros(4),(marker_world-centre)@ez]
restYaw = -math.atan2(ex[2],ex[0])
previous = np.array([centre[0],centre[2],0,0,restYaw,0])
results = []
for n in range(96,30,-1):
    f = E['frames'][n]
    body = max(f['blueBodies'],key=lambda b:b['pixels'])
    hull = np.array(body['hull'],np.float32)
    rect = cv2.boxPoints(cv2.minAreaRect(hull))
    # This take's post-turn UV order is visually checked: far edge points up.
    rect = sorted(rect,key=lambda p:p[1])
    top = sorted(rect[:2],key=lambda p:p[0]); bottom = sorted(rect[2:],key=lambda p:p[0])
    rough = np.array([top[0],top[1],bottom[1],bottom[0]])
    chosen = {}
    for i,name in enumerate(names):
        if i==0 and n<56:
            continue  # covered by fingertips; magenta edge ringing is not a dot
        candidates = [c for c in f['markerCandidates'][name] if c['pixels']>=4]
        if not candidates: continue
        c = min(candidates,key=lambda c:np.linalg.norm(np.array(c['centre'])-rough[i]))
        if np.linalg.norm(np.array(c['centre'])-rough[i])<17:
            chosen[i]=c['centre']
    ids = sorted(chosen)
    observed = np.array([chosen[i] for i in ids])
    xz = table_point(np.array(body['centre']))
    if n>=44:
        def residual(a):
            p = np.array([a[0],a[1],0,0,a[2],0])
            return (project(world(p,markers[ids]))-observed).ravel()
        r = least_squares(residual,[previous[0],previous[1],previous[4]],loss='soft_l1',f_scale=3)
        pose = np.array([r.x[0],r.x[1],0,0,r.x[2],0])
        method = 'fixed-size-table-plane'
    else:
        def residual(p):
            reprojection = (project(world(p,markers[ids]))-observed).ravel()
            below_felt = np.minimum(world(p,corners)[:,1]-surface,0)*2000
            return np.r_[reprojection,below_felt,(p-previous)*[8,8,8,1,1,1]]
        starts = [previous.copy(),np.array([*xz,.08,.8,restYaw,0]),np.array([*xz,.15,1.3,restYaw,0])]
        fits = [least_squares(residual,np.clip(p,[-.6,-.3,0,-2,-3,-2],[.6,.6,.25,2,3,2]),
                bounds=([-.6,-.3,0,-2,-3,-2],[.6,.6,.25,2,3,2]),loss='soft_l1',f_scale=3,max_nfev=160) for p in starts]
        best = min(fits,key=lambda r:np.linalg.norm(residual(r.x)))
        pose=best.x;method='bounded-rigid-lifted-pose'
    predicted = project(world(pose,markers))
    errors = np.linalg.norm(predicted[ids]-observed,axis=1)
    results.append({'frame':n,'pose':pose.tolist(),'quad':project(world(pose,corners)).tolist(),
                    'markerIds':ids,'observed':observed.tolist(),'predicted':predicted.tolist(),
                    'residualPx':errors.tolist(),'method':method,
                    'inferred':len(ids)<4 or n<44})
    previous=pose
results.sort(key=lambda f:f['frame'])
land = [r for r in results if r['frame']>=56]
lift = [r for r in results if r['frame']<44]
summary = {'sourceSha256':E['summary']['sourceSha256'],'fixedSizeMetres':[w,h],'scaleFitted':False,
           'firstFittedFrame':31,'lastFittedFrame':96,
           'landingMeanMarkerErrorPx':float(np.mean([v for r in land for v in r['residualPx']])),
           'liftedMeanMarkerErrorPx':float(np.mean([v for r in lift for v in r['residualPx']])),
           'liftedMaxHeightMetres':max(r['pose'][2] for r in lift),
           'limits':['No pickup or turnover fit. Face-up frames only.',
                     'Lifted fits use a temporal prior and 25cm lift limit; partial-marker poses are inferred.',
                     'Candidate markers are filtered by rough visible card bounds; no visual acceptance implied.',
                     'Marker offsets were calibrated from this same end frame; landing residual measures stability, not independent absolute accuracy.',
                     'Subpixel marker fit cannot establish unique 3D pose with fewer than four observed markers.',
                     'No game, source RGB, card layout, or betting chip changes.']}
(D/'source-review/rigid-fit.json').write_text(json.dumps({'summary':summary,'markersLocal':markers.tolist(),'frames':results},indent=2)+'\n')
show=[31,33,37,40,43,44,48,54,56,64,80,96]
sheet=Image.new('RGB',(1800,1320),'#15191c')
for j,n in enumerate(show):
    r=next(r for r in results if r['frame']==n)
    im=cv2.imread(str(D/'source-review/frames'/f'{n:04}.png'))
    cv2.polylines(im,[np.rint(r['quad']).astype(np.int32)],True,(0,165,255),2,cv2.LINE_AA)
    for p in r['observed']:cv2.circle(im,tuple(np.rint(p).astype(int)),4,(0,0,255),1)
    tile=Image.new('RGB',(600,330),'#15191c')
    crop=Image.fromarray(cv2.cvtColor(im[480:810,850:1400],cv2.COLOR_BGR2RGB));crop.thumbnail((600,298))
    tile.paste(crop,(0,32))
    ImageDraw.Draw(tile).text((6,8),f'Frame {n} | fixed 72x103 mm | error {np.mean(r["residualPx"]):.1f}px | lift {r["pose"][2]*100:.1f}cm',fill='white')
    sheet.paste(tile,((j%3)*600,(j//3)*330))
sheet.save(D/'source-review/rigid-fit.jpg',quality=94)
print(json.dumps(summary))
