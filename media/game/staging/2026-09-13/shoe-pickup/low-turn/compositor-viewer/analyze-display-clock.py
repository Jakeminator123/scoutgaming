import json, sys
from pathlib import Path
source = Path(sys.argv[1])
r = json.loads(source.read_text())
samples = r['cardPaints']
observed = {row['frame'] for row in r['evidence']['rear']}
painted = {row['frame'] for row in samples if row['painted']}
phase = []
for row in r['evidence']['rear']:
    matching = [s for s in samples if s['frame'] == row['frame'] and s['painted']]
    if matching:
        s = matching[0]
        phase.append({'frame': row['frame'], 'submissionMinusExpectedMs': s['paintTime'] - row['expectedDisplayTime'], 'completionMinusExpectedMs': s['paintTime'] + s['paintMs'] - row['expectedDisplayTime']})
report = {'source': source.name, 'nativeQuality': r['quality'], 'distinctPaintedFrames': len(painted), 'missingCardSamplesExcludingInitial': sorted(set(range(1,r['count']))-painted), 'paintedWithoutRearCallback': sorted(painted-observed), 'phase': phase, 'qualification': 'JavaScript submission/completion timestamps are not actual GPU/display presentation timestamps. Complete sampled frame coverage does not establish actor/card visual phase or rear/front synchronization.'}
output = source.with_name(source.stem + '-analysis.json')
output.write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k != 'phase'}))
