"""Analyze saved browser UI receipt; never infer native presentation from callbacks."""
import json,sys,statistics
from pathlib import Path
src=Path(sys.argv[1]);raw=json.loads(src.read_text());d=raw.get('playback',raw)
if isinstance(d,str):d=json.loads(d)
runs=d.get('runs',[d.get('latest',d)]);out=[]
def distribution(values):
 a=sorted(values)
 return None if not a else {'median':statistics.median(a),'p95':a[min(len(a)-1,int(.95*len(a)))],'max':max(a)}
for r in runs:
 seen={x['frame'] for x in r.get('observations',[])};missing=[n for n in range(89) if n not in seen];paints=r.get('paints',[])
 out.append({'run':r.get('run'),'issuedCardId':r.get('issuedCardId'),'qualityDelta':r.get('qualityDelta'),'distinctCallbackFrames':len(seen),'missingCallbackFrames':missing,'missingByWindow':{'startup0to14':[n for n in missing if n<15],'ongoing15to74':[n for n in missing if 15<=n<75],'return75to88':[n for n in missing if n>=75]},'paintMs':distribution([p['durationMs'] for p in paints]),'paintMsStartup':distribution([p['durationMs'] for p in paints if p['frame']<15]),'paintMsOngoing':distribution([p['durationMs'] for p in paints if p['frame']>=15]),'decodeSeconds':distribution([p['processingDuration'] for p in r.get('observations',[]) if p.get('processingDuration') is not None]),'landings':r.get('landings'),'outcome':r.get('outcome')})
report={'source':str(src),'runs':out,'sameIssuedCard':len({r['issuedCardId'] for r in out})==1,'limit':'Quality delta reports decoder drops. Missing callbacks and GPU paint completion do not establish display phase or visible frame presentation. Compare repeated runs; startup attribution requires concentration early and warm improvement.'};print(json.dumps(report,indent=2))
