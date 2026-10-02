"""Import native-pixel observations into a DRAFT; never marks a take approved.
Usage: python import-observations.py observations.json draft.json
No source rendering, interpolation, publication or guesses are performed.
"""
from pathlib import Path
import json,sys,hashlib,math
if len(sys.argv)!=3: raise SystemExit(__doc__)
data=json.loads(Path(sys.argv[1]).read_text())
src=Path(data['sourcePath']);actual=hashlib.sha256(src.read_bytes()).hexdigest()
assert actual==data['sourceSha256'],'Source bytes changed'
w,h=data['nativeDimensions'];tw,th=data.get('canvasDimensions',[1920,1080])
assert min(w,h,tw,th)>0
scale=min(tw/w,th/h);dx=(tw-w*scale)/2;dy=(th-h*scale)/2
def point(p):
    assert len(p)==2 and all(math.isfinite(v) for v in p)
    assert 0<=p[0]<=w and 0<=p[1]<=h
    return [(dx+p[0]*scale)/tw,(dy+p[1]*scale)/th]
assert data.get('observer') and data.get('date'),'Named inspection required'
e=data['events'];assert 0<=e['pickup']<e['release']<=e['land']<e['rest']<data['frames']
byframe={r['frame']:r for r in data['observations']}
assert len(byframe)==len(data['observations']),'Duplicate frame'
rows=[];missing=[]
for frame in range(data['frames']):
    r=byframe.get(frame)
    if not e['pickup']<=frame<=e['land']:
        rows.append({'frame':frame,'card':None});continue
    if not r or r.get('visibility')!='fully-measurable' or len(r.get('cornersNative',[]))!=4:
        missing.append(frame);rows.append({'frame':frame,'card':None,'diagnostic':'unmeasured or occluded; cannot publish'});continue
    assert r.get('method')=='manual-visible-card-corners'
    assert isinstance(r.get('faceUp'),bool)
    row={'frame':frame,'card':{'corners':[point(p)+[0] for p in r['cornersNative']],'faceUp':r['faceUp']}}
    if frame<=e['release']:
        assert r.get('fingerVisible') is True and r.get('fingerNative'),'Do not infer hidden fingers'
        # Kept OUTSIDE the playable contact object: importing observations does not
        # certify contact, produce a foreground matte or inspect a packed render.
        row['observedFinger']=point(r['fingerNative'])
    rows.append(row)
out={'status':'draft-not-playable','sourceSha256':actual,'camera':{'width':tw,'height':th,'shoeOutlet':point(data['shoeOutletNative'])},'nativeToCanvas':{'scale':scale,'offset':[dx,dy]},'events':e,'frames':rows,'unmeasuredFrames':missing,'observer':data['observer'],'date':data['date'],'requiredBeforeManifest':['Inspect all source corners and occlusions; do not guess missing corners','Build source-card removal and finger-over-card matte','Pack RGB and masks with one clock','Measure any resampled frames and update event indices','Verify runtime modeled outlet and full handoff','Bind packed media and calibration SHA, keep review status']}
Path(sys.argv[2]).write_text(json.dumps(out,indent=2)+'\n')
print(f'Draft only: {len(missing)} delivery frames remain unmeasured; no measured:true claims written.')
