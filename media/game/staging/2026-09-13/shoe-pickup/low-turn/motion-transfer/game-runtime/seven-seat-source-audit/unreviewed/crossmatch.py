from pathlib import Path
import hashlib,json
here=Path(__file__).resolve().parent;repo=next(p for p in here.parents if p.name=='croupier');base=repo/'content/staging/2026-09-13/shoe-pickup/low-turn/motion-transfer/next-source-investigation/existing-continuation-search';known=set()
for f in [base/'search.json',base/'extended/inventory.json',here.parent/'legacy-source-provenance.json']:
 for row in json.load(open(f)):
  p=Path(row.get('path',row.get('source','')));p=p if p.is_absolute()else repo/p
  if p.is_file():known.add(hashlib.sha256(p.read_bytes()).hexdigest())
records=[];groups={}
for rel in Path('/tmp/astrid-local-video-inventory.txt').read_text().splitlines():
 p=repo/rel
 if not p.is_file():continue
 sha=hashlib.sha256(p.read_bytes()).hexdigest();reason=None
 if sha in known:reason='same original hash already covered by14/extended10/seven-seat audits'
 elif any(s in rel for s in ['/prepared/','/public/','/in-game','/cac-qa/','/cac-followup/','/final-round/','/initial-deal/','/dealer-turn/','/native-player/','/cycle-preview/','/integration-diagnostic/','/cadence','/compositor-viewer/','/camera-paper','/web-surface/','/regrip-assessment/','/motion-registration/','/gray-alpha','/edge-cleanup/','/pickup-card/','/pickup-composite/','/pickup-pace/']):reason='derived/rendered/packed/game recording path'
 elif any(s in rel for s in ['/return-','/scene-joins/','/centre-entry/','/ready-at-table/','/low-turn/return.mp4','/empty-return.mp4']):reason='entry/return/idle-only source or derivative, no new delivery endpoint'
 elif any(s in rel for s in ['astrid-goodluck','astrid-win','mei-']):reason='speech/reaction/other-dealer'
 elif any(s in rel for s in ['astrid-deal.mp4','astrid-deal-retry','astrid-deal-cleanup','astrid-deal-mime']):reason='already reviewed/rejected in docs/ASTRID-DEALING-RETAKE.md; no new coverage'
 elif any(s in rel for s in ['/next-source-investigation/','/release-continuation/source.mp4','/game-runtime/box1/']):reason='recently reviewed primitive/continuation/derived packed source in current task'
 else:reason='remaining source candidate: inspect metadata/footage'
 row={'path':rel,'sha256':sha,'bytes':p.stat().st_size,'classification':reason};records.append(row);groups.setdefault(sha,[]).append(rel)
meta={'inputCount':len(records),'uniqueHashes':len(groups),'knownOriginalHashes':len(known),'records':records,'duplicateGroups':[v for v in groups.values()if len(v)>1]};json.dump(meta,open(here/'crossmatch.json','w'),indent=2)
for row in records:
 if row['classification'].startswith('remaining'):print(row['path'],row['sha256'])
