"""Trace this immutable green prop. Inference is explicit; no gameplay edits."""
from pathlib import Path
import hashlib, json, cv2, numpy as np
from PIL import Image, ImageDraw

P = Path(__file__).parent
SOURCE = P.parent / 'source.mp4'
# Material UV order [00,10,11,01], carried through time without screen sorting.
# The 27-29 blurred edge-on interval cannot uniquely identify material corners;
# its correspondence (and the semantic back/front change) is an authored inference.
PICKS = {
0:[[1278,625],[1312,650],[1275,693],[1233,668]],
1:[[1279,625],[1312,650],[1273,694],[1231,668]],
2:[[1279,625],[1312,650],[1268,696],[1227,668]],
3:[[1280,623],[1312,650],[1259,700],[1221,671]],
4:[[1280,609],[1303,651],[1233,706],[1193,663]],
5:[[1280,609],[1303,651],[1233,706],[1193,663]],
6:[[1250,593],[1282,634],[1218,694],[1174,644]],
7:[[1221,561],[1256,608],[1201,668],[1149,618]],
8:[[1175,503],[1220,551],[1163,616],[1116,570]],
9:[[1157,485],[1206,534],[1150,598],[1101,548]],
10:[[1157,485],[1206,534],[1150,598],[1101,548]],
11:[[1141,477],[1188,520],[1134,578],[1087,534]],
12:[[1112,470],[1154,509],[1106,558],[1059,516]],
13:[[1100,473],[1142,506],[1094,554],[1048,514]],
14:[[1089,478],[1130,509],[1084,554],[1036,514]],
15:[[1089,478],[1130,509],[1084,554],[1036,514]],
16:[[1070,491],[1108,523],[1060,560],[1013,516]],
17:[[1061,495],[1096,525],[1048,558],[1005,518]],
18:[[1051,500],[1086,528],[1036,560],[995,518]],
19:[[1040,504],[1077,535],[1029,560],[987,522]],
20:[[1035,508],[1071,538],[1020,562],[979,524]],
21:[[1030,513],[1067,541],[1007,566],[973,528]],
22:[[1025,518],[1062,548],[1006,570],[965,536]],
23:[[1026,529],[1061,557],[1004,578],[965,544]],
24:[[1030,541],[1065,568],[1014,590],[971,560]],
25:[[1050,562],[1072,583],[1034,602],[981,583]],
26:[[1068,583],[1080,602],[1032,614],[1000,607]],
27:[[1082,601],[1072,619],[1007,657],[1004,641]],
28:[[1069,602],[1029,699],[1019,699],[1061,603]],
29:[[1069,602],[1029,699],[1019,699],[1061,603]],
30:[[1090,602],[1047,692],[1037,667],[1061,575]],
31:[[1080,594],[1053,694],[1013,665],[1027,577]],
32:[[1046,590],[1048,697],[992,693],[991,594]],
33:[[1037,605],[1048,696],[991,696],[984,611]],
34:[[1037,605],[1048,696],[991,696],[984,611]],
35:[[1033,615],[1044,694],[987,696],[978,622]],
36:[[1020,622],[1030,690],[975,692],[966,626]],
37:[[1013,621],[1022,686],[964,688],[958,624]],
38:[[1006,619],[1012,684],[956,686],[950,622]],
39:[[1006,619],[1012,684],[956,686],[950,622]],
40:[[993,616],[998,680],[938,678],[938,618]],
41:[[987,614],[992,678],[934,678],[934,616]],
42:[[987,614],[991,676],[934,678],[932,616]],
}
FINAL = [[987,614],[990,675],[931,675],[933,614]]
frames=[]
for n in range(97):
    physical=PICKS[n] if n in PICKS else FINAL
    # A single constant cyclic permutation puts the printed top toward Astrid
    # at landing. No source corner uniquely identifies a printed top edge.
    q=[physical[i] for i in [3,0,1,2]]
    if n<4: method='visible-three-edge-plane-with-grip-occlusion'; confidence=.76; inferred=[3]
    elif n<19: method='manually-reviewed-source-plane'; confidence=.84; inferred=[3]
    elif n<24: method='two-hand-transfer-plane'; confidence=.75; inferred=[1]
    elif n<27: method='blurred-wrist-plane'; confidence=.57; inferred=[0,1]
    elif n<30: method='inferred-edge-on-corner-correspondence'; confidence=.32; inferred=[0,1,2,3]
    elif n<32: method='post-turn-visible-edge-with-hidden-top-corner'; confidence=.62; inferred=[0]
    elif n<43: method='sliding-plane-with-hidden-far-right-corner'; confidence=.80; inferred=[0]
    elif n<57: method='stationary-plane-from-later-unoccluded-edges'; confidence=.92; inferred=[0]
    else: method='stationary-four-edge-and-marker-fit'; confidence=.96; inferred=[]
    inferred=sorted((i+1)%4 for i in inferred)
    phase=('exposed-outlet' if n<3 else 'extraction' if n<7 else 'raised-carry' if n<18 else 'hand-transfer' if n<24 else 'wrist-turn' if n<30 else 'lowering' if n<33 else 'contact-slide' if n<43 else 'stationary-contact' if n<55 else 'release' if n<58 else 'empty-return' if n<73 else 'ready-at-shoe')
    frames.append(dict(frame=n,time=round(n/24,8),quad=q,method=method,confidence=confidence,
        cornersSupportedByVisibleEvidence=[c for c in range(4) if c not in inferred],inferredCorners=inferred,
        phase=phase,handContact=n<=56,stationary=n>=43,faceUp=n>=30,
        faceUpProvenance='authored semantic switch after observed edge-on wrist rotation; identical green source faces do not identify card face/back',
        materialCorrespondence='continuous source-visible corners' if n<27 else 'inferred through edge-on frames27-29, then fixed through landing'))

(P/'annotated').mkdir(exist_ok=True)
(P/'card-visible-masks').mkdir(exist_ok=True)
tiles=[]
for f in frames:
    n=f['frame']; im=cv2.imread(str(P/'frames'/f'{n+1:03}.png'))
    q=np.array(f['quad'],np.float32); qi=np.round(q).astype(np.int32)
    roi=np.zeros(im.shape[:2],np.uint8); cv2.fillConvexPoly(roi,qi,255)
    hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
    lime=cv2.inRange(hsv,np.array([35,60,65]),np.array([59,255,255]))
    magenta=cv2.inRange(hsv,np.array([120,30,30]),np.array([179,255,255]))
    visible=cv2.bitwise_and(cv2.bitwise_or(lime,magenta),roi)
    cv2.imwrite(str(P/'card-visible-masks'/f'{n:03}.png'),visible)
    annotated=im.copy();cv2.polylines(annotated,[qi],True,(255,0,255),1,cv2.LINE_AA)
    for i,pt in enumerate(qi):
        color=(0,255,255) if i in f['inferredCorners'] else (255,255,0)
        cv2.circle(annotated,tuple(pt),3,color,-1)
        cv2.putText(annotated,str(i),tuple(pt+np.array([5,-5])),cv2.FONT_HERSHEY_SIMPLEX,.4,color,1,cv2.LINE_AA)
    cv2.putText(annotated,f'{n:02} {n/24:.3f}s {f["phase"]} confidence {f["confidence"]:.2f}',(15,30),cv2.FONT_HERSHEY_SIMPLEX,.7,(255,255,255),2,cv2.LINE_AA)
    cv2.imwrite(str(P/'annotated'/f'{n:03}.jpg'),annotated,[cv2.IMWRITE_JPEG_QUALITY,90])
    cx,cy=q.mean(0);x0=max(0,min(1520,int(cx)-200)); y0=max(0,min(780,int(cy)-150))
    tile=Image.new('RGB',(400,335),'#111');tile.paste(Image.fromarray(cv2.cvtColor(annotated[y0:y0+300,x0:x0+400],cv2.COLOR_BGR2RGB)),(0,30))
    ImageDraw.Draw(tile).text((5,5),f'{n:02} {n/24:.3f}s {f["phase"]} conf {f["confidence"]}',fill='white'); tiles.append(tile)
for s in range(0,97,20):
    sheet=Image.new('RGB',(1600,1675),'#111')
    for i,tile in enumerate(tiles[s:s+20]):sheet.paste(tile,((i%4)*400,(i//4)*335))
    sheet.save(P/f'annotated-sheet-{s:02}.jpg',quality=92)

sha=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
events={
 'reachContact':{'frame':0,'seconds':0,'note':'already touching in source first frame; no prior reach exists'},
 'extractionStarts':{'frame':3,'seconds':3/24,'uncertaintyFrames':1},
 'clearsShoe':{'frame':7,'seconds':7/24,'uncertaintyFrames':1},
 'handTransferStarts':{'frame':18,'seconds':18/24,'uncertaintyFrames':1},
 'handTransferComplete':{'frame':24,'seconds':1.0,'uncertaintyFrames':1},
 'wristTurnEdgeOn':{'frames':[27,28,29],'seconds':[27/24,29/24],'uncertaintyFrames':1},
 'faceUp':{'frame':30,'seconds':30/24,'inferred':True,'note':'semantic face/back switch inferred from wrist turn, not measured from identical green faces'},
 'firstTableContact':{'frame':33,'seconds':33/24,'uncertaintyFrames':2},
 'slideStops':{'frame':43,'seconds':43/24,'uncertaintyFrames':1},
 'fingerRelease':{'frame':57,'seconds':57/24,'uncertaintyFrames':1},
 'landCue':{'frame':58,'seconds':58/24,'note':'after visible fingertip separation; earlier contact is not release'},
 'emptyReturnComplete':{'frame':73,'seconds':73/24,'uncertaintyFrames':2,'note':'empty receiving hand returns next to shoe; other hand stays near dealer card'},
}
result=dict(version=1,source=str(SOURCE.resolve()),sourceSha256=sha,jobId='de1f90a9-b8db-4a64-a46d-7c8f9d0665ef',
 width=1920,height=1080,fps=24,frameCount=97,coordinateSpace='native decoded source pixels; origin top-left; x right, y down',
 cornerOrder='fixed UV00,UV10,UV11,UV01; endpoint far-left,far-right,near-right,near-left; one constant cyclic permutation across all97frames; no per-frame screen sorting',
 scope='first face-up card to Astrid herself only',events=events,frames=frames,
 limits=[
 'All 97 native frames reviewed; plane fits during blur/occlusion are approximations, not calibrated rigid 3D reconstruction.',
 'Frames27-29 lose all identifiable green/magenta marker evidence. Their thin plane and material corner correspondence are inferred with low confidence.',
 'FaceUp false through29 and true from30 is an authored semantic face/back assignment at the visible wrist turn. Identical green faces cannot prove the physical side.',
 'Printed-top UV orientation is authored so the landed card is upright to the player. A constant cyclic corner permutation is applied across all97frames; identical green markers do not identify a printed top edge.',
 'Source starts with fingers already holding a partially exposed card. Do not synthesize a pre-source reach or delay card visibility until pickup.',
 'First felt contact around33 is not finger release. Card continues sliding until43 and remains under fingers through56.',
 'Final source hands differ from the initial at-shoe grasp. This clip is not an automatically seamless loop.',
 'Replacement card must remain below actual finger matte; registration must move actor, shoe and card together.',
 'These are source measurements, not rendered-gameplay acceptance.'
 ])
(P/'card-track.json').write_text(json.dumps(result,indent=2)+'\n')
shoe=dict(sourceSha256=sha,measuredFrame=7,coordinateSpace=result['coordinateSpace'],
 frontLipEdge=[[1244,662],[1287,685]],frontLipAnchor=[1265.5,673.5],frontLipUncertaintyPx=4,
 throatEdge=[[1275,625],[1310,643]],throatAnchor=[1292.5,634],throatUncertaintyPx=4,
 firstFrameCardQuad=frames[0]['quad'],firstFrameCardCentroid=np.mean(PICKS[0],axis=0).tolist(),
 note='Match the rendered outlet definition to the correct source feature. Front lower tray lip and upper mouth throat are different anchors; do not conflate them.')
(P/'shoe-registration.json').write_text(json.dumps(shoe,indent=2)+'\n')
im=cv2.imread(str(P/'frames/008.png'))
for line,color,label in [(shoe['frontLipEdge'],(0,255,255),'front lip'),(shoe['throatEdge'],(255,255,0),'throat')]:
    pts=np.array(line,np.int32); cv2.polylines(im,[pts],False,color,3)
    c=tuple(np.mean(pts,axis=0).astype(int));cv2.circle(im,c,5,color,-1);cv2.putText(im,label,(c[0]-110,c[1]+20),cv2.FONT_HERSHEY_SIMPLEX,.5,color,1,cv2.LINE_AA)
cv2.imwrite(str(P/'shoe-registration.jpg'),im[480:760,1160:1510])
areas=[cv2.contourArea(np.array(f['quad'],np.float32),oriented=True) for f in frames]
assert all(a>0 for a in areas),[(i,a) for i,a in enumerate(areas) if a<=0]
assert all(cv2.isContourConvex(np.array(f['quad'],np.float32)) for f in frames),[f['frame'] for f in frames if not cv2.isContourConvex(np.array(f['quad'],np.float32))]
print(json.dumps({'frames':len(frames),'minQuadArea':min(areas),'maxQuadArea':max(areas),'sourceSha256':sha,'events':events}))
