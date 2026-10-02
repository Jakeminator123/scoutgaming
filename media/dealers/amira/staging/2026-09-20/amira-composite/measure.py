from pathlib import Path
import json, cv2, numpy as np, hashlib
R=Path(__file__).resolve().parents[4]
S=R/'content/staging/2026-09-20'
OUT=R/'web/public/review/amira-composite'
manifest=json.loads((R/'web/public/review/amira-green-speak/speak.json').read_text())
tracks={}; stats={}
for name,line in [('waiting',json.loads((R/'web/public/review/amira-green-waiting/idle.json').read_text())['base'])]+[(k,v['media']) for k,v in manifest['lines'].items()]:
    folder=S/'amira-table-waiting' if name=='waiting' else S/'amira-table-speech'/name
    files=sorted((folder/'frames').glob('*.png'))
    crop=(630,12,706,696) if name=='waiting' else (420,0,470,464)
    x,y,w,h=crop
    first=cv2.imread(str(files[0]))[y:y+h,x:x+w]
    # Contact anchors are measured on the actor, in the unscaled source crop.
    patches=[(166,544,89,79),(586,539,64,92),(69,487,86,48),(545,477,83,48)] if name=='waiting' else [(108,378,57,53),(391,367,42,63),(40,328,61,35),(357,322,51,35)]
    samples=[]; scores=[]
    for f in files:
        rgb=cv2.imread(str(f))[y:y+h,x:x+w]
        g=cv2.cvtColor(rgb,cv2.COLOR_BGR2GRAY); points=[]; frame_scores=[]
        for px,py,pw,ph in patches:
            template=cv2.cvtColor(first[py:py+ph,px:px+pw],cv2.COLOR_BGR2GRAY)
            pad=22 if name=='waiting' else 15
            xa,ya=max(0,px-pad),max(0,py-pad)
            search=g[ya:min(h,py+ph+pad),xa:min(w,px+pw+pad)]
            _,score,_,loc=cv2.minMaxLoc(cv2.matchTemplate(search,template,cv2.TM_CCOEFF_NORMED))
            points.append([xa+loc[0]+pw/2,ya+loc[1]+ph*.5])
            frame_scores.append(score)
        samples.append(points);scores.append(frame_scores)
    samples=np.array(samples)
    # A three-sample median removes codec jitter; no actor pixels are modified.
    smooth=samples.copy()
    for i in range(len(samples)):smooth[i]=np.median(samples[max(0,i-1):min(len(samples),i+2)],axis=0)
    tracks[name]={'sha256':line['sha256'],'fps':line['fps'],'width':w,'height':h,'frames':len(files),'points':np.round(smooth,2).tolist(),'confidenceMin':np.min(scores,axis=0).round(4).tolist()}
    face=first[85:183,284:402] if name=='waiting' else first[46:108,184:246]
    values=cv2.cvtColor(face,cv2.COLOR_BGR2RGB).reshape(-1,3)/255.
    skin=values[(values[:,0]-values[:,2]>.13)&(values[:,0]>values[:,1])&(values[:,1]>.25)]
    lum=skin @ np.array([.2126,.7152,.0722])
    stats[name]={'rgbMedian':np.median(skin,axis=0).tolist(),'lumaPercentiles':np.percentile(lum,[10,50,90,99]).tolist()}
    if name in ['waiting','greeting','goodluck','dealerblackjack']:
        # Exact exported packed frame; for controlled GPU before/after proof.
        cap=cv2.VideoCapture(str(R/'web/public'/line['src']));cap.set(cv2.CAP_PROP_POS_FRAMES,0);ok,packed=cap.read();cap.release()
        if ok:cv2.imwrite(str(OUT/f'{name}-frame0.png'),packed)
(OUT/'contacts.json').write_text(json.dumps({'version':1,'space':'native crop pixels','anchors':['leftHand','rightHand','leftForearm','rightForearm'],'clips':tracks},separators=(',',':')))
(S/'amira-composite/measurements.json').write_text(json.dumps(stats,indent=2))
print(json.dumps({'speech':stats['greeting'],'waiting':stats['waiting'],'trackMin':{k:v['confidenceMin'] for k,v in tracks.items()}},indent=2))
