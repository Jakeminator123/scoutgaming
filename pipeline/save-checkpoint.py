#!/usr/bin/env python3
"""Save committed history, handoff and a private readable conversation.
Usage: python3 pipeline/save-checkpoint.py --transcript /path/to/rollout.jsonl
The bundle excludes dirty/untracked files; a separate archive preserves local
media/code under content, pipeline, test and web/public. No database is copied.
"""
import argparse, datetime, hashlib, json, pathlib, re, shutil, subprocess, tarfile
from zoneinfo import ZoneInfo
parser=argparse.ArgumentParser()
parser.add_argument('--transcript', type=pathlib.Path)
parser.add_argument('--destination', type=pathlib.Path, default=pathlib.Path.home()/'Desktop/Croupier-Backups')
args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
now=datetime.datetime.now().astimezone()
out=args.destination/now.strftime('%Y%m%d-%H%M%S')
out.mkdir(parents=True, exist_ok=False)
out.chmod(0o700)
def git(*a): return subprocess.check_output(['git','-C',str(root),*a],text=True)
head=git('rev-parse','HEAD').strip()
subprocess.run(['git','-C',str(root),'bundle','create',str(out/'croupier.bundle'),'--all'],check=True)
subprocess.run(['git','-C',str(root),'bundle','verify',str(out/'croupier.bundle')],check=True,stdout=subprocess.DEVNULL)
for name in ['JOHN-HANDOFF.md','ENVIRONMENT-RESTORATION.md','dealer-sync-baseline.json']:
 shutil.copy2(root/'docs'/name,out/name)
(out/'working-tree-status.txt').write_text(git('status','--short'))
(out/'commits.txt').write_text(git('log','-30','--oneline'))
working = sorted(set(git('ls-files','-m','-o','--exclude-standard','-z').split('\0')))
working = [p for p in working if p.startswith(('content/','pipeline/','test/','web/public/')) and '__pycache__' not in p and (root/p).is_file() and not (root/p).is_symlink()]
with tarfile.open(out/'working-media-and-code.tar', 'w') as archive:
 for path in working: archive.add(root/path, arcname=path, recursive=False)
count=0
if args.transcript:
 messages=[]
 for raw in args.transcript.open():
  try:record=json.loads(raw)
  except json.JSONDecodeError:continue
  item=record.get('payload',{});role=item.get('role')
  if record.get('type')!='response_item' or item.get('type')!='message' or role not in ('user','assistant'):continue
  if role=='assistant' and item.get('phase') not in ('commentary','final_answer') and item.get('channel') not in ('commentary','final'):continue
  text='\n'.join(c.get('text','') for c in item.get('content',[]) if c.get('type') in ('input_text','output_text'))
  if not text or '<environment_context>' in text or '<recommended_plugins>' in text:continue
  text=re.sub(r'<in-app-browser-context\b.*?</in-app-browser-context>','',text,flags=re.S)
  text=re.sub(r'\b(?:sk-[A-Za-z0-9_-]{15,}|sbp_[A-Za-z0-9]{15,}|glpat-[A-Za-z0-9_-]{10,})\b','[credential redacted]',text)
  stamp=datetime.datetime.fromisoformat(record['timestamp'].replace('Z','+00:00')).astimezone(ZoneInfo('Europe/Stockholm')).strftime('%Y-%m-%d %H:%M:%S')
  messages.append(f'## {stamp} — {"You" if role=="user" else "Codex"}\n\n{text.strip()}\n')
 count=len(messages)
 (out/'conversation.md').write_text('# Saved conversation\n\nUser and assistant messages only. Tool output and internal summaries excluded. Times: Europe/Stockholm.\n\n'+'\n'.join(messages))
manifest={'created':now.isoformat(),'commit':head,'conversationMessages':count,'workingFiles':working,'scope':'Committed Git history plus separate archive of nonignored modified/untracked files under content, pipeline, test and web/public. Database, ignored files and other private configuration are excluded.','sha256':{}}
for file in out.iterdir():
 if file.is_file():
  digest=hashlib.sha256()
  with file.open('rb') as f:
   for chunk in iter(lambda:f.read(1024*1024),b''):digest.update(chunk)
  manifest['sha256'][file.name]=digest.hexdigest()
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(out)
