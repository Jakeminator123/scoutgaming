import sys;sys.path.insert(0,'/tmp/astrid-optical-flow')
import cv2,numpy as np,json,hashlib
from pathlib import Path
here=Path(__file__).resolve().parent;repo=next(p for p in here.parents if p.name=='croupier');source=repo/'content/staging/2026-09-09/contact-proof/source.mp4';fit=json.load(open(here.parent/'card-fit/keypose-fixed-plane.json'));c=cv2.VideoCapture(str(source));_,zero=c.read()
polygons={'black_front_fascia_above_outlet':[[1210,590],[1263,617],[1263,637],[1210,613]],'stack_top_and_right_face':[[1210,588],[1296,492],[1353,522],[1353,568],[1264,644],[1264,617]],'left_rail':[[1186,608],[1288,479],[1294,481],[1294,492],[1194,615],[1194,635],[1186,632]],'right_sidewall':[[1264,618],[1355,522],[1362,521],[1362,568],[1259,669],[1256,666],[1257,644]]}
# The fixed black fascia carries logo/detail; only the thin lower seam is the outlet. Tray remains behind extracted paper.
mask=np.full((1080,1920),255,np.uint8)
for q in polygons.values():cv2.fillPoly(mask,[np.array(q,np.int32)],0)
cv2.imwrite(str(here/'allowed-card.png'),mask)
q0=zero.copy()
for name,q in polygons.items():cv2.polylines(q0,[np.array(q,np.int32)],True,(0,0,255),1)
cv2.imwrite(str(here/'source0-hardware-polygons.jpg'),cv2.resize(q0[450:710,1160:1390],None,fx=3,fy=3))
tiles=[];rows=[]
for rec in fit['records']:
 n=rec['frame']
 if n not in [38,45,49]:continue
 c.set(1,n);_,a=c.read();card=np.zeros_like(mask);cv2.fillPoly(card,[np.rint(rec['corners']).astype(np.int32)],255);visible=(card>0)&(mask>0);out=a.copy();out[visible]=(out[visible]*.3+np.array([20,40,220])*.7).astype(np.uint8);cv2.polylines(out,[np.rint(rec['corners']).astype(np.int32)],True,(255,170,0),1)
 panels=[cv2.resize(z[540:700,1150:1350],(600,480))for z in [a,out]];tile=np.concatenate(panels,axis=1);cv2.putText(tile,f'n{n}: SOURCE | fixed-plane proxy allowed (red), full outline cyan',(5,22),0,.65,(0,255,255),1);tiles.append(tile);rows.append({'sourceNative':n,'fullProxyPixels':int(np.count_nonzero(card)),'allowedProxyPixels':int(np.count_nonzero(visible))})
cv2.imwrite(str(here/'early-proxy-proof.jpg'),np.concatenate(tiles));meta={'status':'source-specific static hardware mask PROPOSAL, not game3D calibration or accepted extraction fit','dimensions':[1920,1080],'coordinateFrame':'original contact-proof/source.mp4 native pixels xright ydown','mask':'allowed-card.png','encoding':'8bit grayscale255 allows card,0 static housing occludes; load NoColorSpace,flipY=false when shader uses source-top-left UV','sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'maskSHA256':hashlib.sha256((here/'allowed-card.png').read_bytes()).hexdigest(),'polygons':polygons,'suggestedGate':'Source38-48 extraction only;49 fully out, disable. Gate must be reviewed with final trajectory.','uncertainty':'Manual source0 housing edges +/-2nativepx; left mouth shadow ambiguous. Thin lower outlet seam and tray interior explicitly open; black logo-bearing fascia above it is opaque housing. Tray front lip is below the observed extractedpaper, excluded from foreground mask rather than incorrectly cutting it.','proofRows':rows};(here/'receipt.json').write_text(json.dumps(meta,indent=2))
