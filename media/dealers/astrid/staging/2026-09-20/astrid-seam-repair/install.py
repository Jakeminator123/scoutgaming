#!/usr/bin/env python3
"""Install only the measured revision, rejecting stale source/audio bindings."""
import hashlib,json,shutil
from pathlib import Path
HERE=Path(__file__).resolve().parent;REPO=HERE.parents[3];PUB=REPO/'web/public';OUT=HERE/'runtime'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
inputs=json.loads((HERE/'inputs.json').read_text());take=json.loads((OUT/'speak.json').read_text());idle=json.loads((OUT/'idle.json').read_text())
assert sha(PUB/idle['base']['src'])==idle['base']['sha256']
for name,line in take['lines'].items():
 old=inputs['speak']['lines'][name]
 assert sha(PUB/old['media']['src'])==line['media']['parentPackedSha256']
 assert sha(PUB/line['audio'])==line['audioSha256']
 for key in ['audioOffsetSeconds','cutIn','cutOut','audio','audioSha256','text']:assert line[key]==old[key],(name,key)
 for key in ['frames','fps','width','height','sourceSha256','nativeTakeSha256']:assert line['media'][key]==old['media'][key],(name,key)
 for edge in ['enter','exit']:
  info=line['transition'][edge];src=OUT/info['flow'];assert sha(src)==info['sha256'];dst=PUB/info['src'];dst.parent.mkdir(exist_ok=True);shutil.copyfile(src,dst)
for info in json.loads((OUT/'files.json').read_text()):
 src=OUT/info['file'];assert sha(src)==info['sha256'];dst=PUB/info['src'];dst.parent.mkdir(exist_ok=True);shutil.copyfile(src,dst)
for dest,data in [(PUB/'review/astrid-green-waiting/idle.json',idle),(PUB/'review/astrid-green-speak/speak.json',take)]:dest.write_text(json.dumps(data,indent=2)+'\n')
config=REPO/'content/staging/2026-09-19/astrid-green-waiting/take-config.json';data=json.loads(config.read_text());data['restManifest']='../../2026-09-20/astrid-seam-repair/runtime/rest.json';config.write_text(json.dumps(data,indent=2)+'\n')
revision=REPO/'content/staging/2026-09-19/astrid-green-speak-elevenlabs/registration/display-revision.json';revision.write_text(json.dumps({'manifest':'../../2026-09-20/astrid-seam-repair/runtime/speak.json','sha256':sha(OUT/'speak.json')},indent=2)+'\n')
print('Installed calibrated Astrid review. Original sources/audio unchanged.')
