"""Measure indexed Astrid performances without replacing any shipped AV.

Run with the same Python environment as capture-dealer-face.py. The output is
staged measurement data; capture success is not human lip-sync acceptance.
"""
import argparse, hashlib, json, subprocess, sys
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('output',type=Path)
parser.add_argument('--exclude',nargs='*',default=[])
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
base=root/'media/dealers/astrid/runtime/indexed'
index=json.loads((base/'streams/index.json').read_text())
bank=json.loads((base/'audio/en/bank.json').read_text())
args.output.mkdir(parents=True,exist_ok=True)
inventory={'dealer':'astrid','status':'measured-not-visually-approved','lines':{},'excluded':args.exclude}
for line,entry in bank.items():
    if line in args.exclude:continue
    clip=index['clips']['idle-1/speak/'+line]
    target=args.output/(line+'.json')
    command=[sys.executable,str(root/'pipeline/capture-dealer-face.py'),str(base/'streams'/clip['file']),str(target),
      '--fps',str(clip['fps']),'--expected-frame-count',str(clip['frameCount']),
      '--audio',str(base/'audio/en'/(line+'.mp3')),'--audio-delay-ms',str(clip.get('audioDelayMs',0)),
      '--line-id',line,'--text',entry['text']]
    with (args.output/(line+'.log')).open('w') as log:
        subprocess.run(command,check=True,stdout=log,stderr=subprocess.STDOUT)
    data=json.loads(target.read_text())
    inventory['lines'][line]={'file':target.name,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
      'frames':len(data['frames']),'missing':len(data['missingTimes']),'duration':data['duration'],
      'binding':data['binding'],'status':data['status']}
    (args.output/'inventory.json').write_text(json.dumps(inventory,indent=2))
    print(line,len(data['frames']),'frames;',len(data['missingTimes']),'missing',flush=True)
