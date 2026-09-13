"""Run the existing video game with a separate local demo database."""
import os, shutil, subprocess
from pathlib import Path

here = Path(__file__).resolve().parent
repo = here.parents[3]
runtime = here / 'runtime'
runtime.mkdir(exist_ok=True)
for source in (repo / 'web').glob('*.mjs'):
    shutil.copy2(source, runtime / source.name)
public = runtime / 'public'
if not public.exists():
    public.symlink_to(repo / 'web/public', target_is_directory=True)
env = dict(os.environ, HOST='127.0.0.1', PORT='4173', DEMO_GUEST_ACCESS='1')
print('Astrid video: http://astriddealing.localhost:4173/?dealer=astrid&performance=staged', flush=True)
with (here / 'server.log').open('a') as log:
    raise SystemExit(subprocess.call(['node', str(runtime / 'server.mjs')], env=env, stdout=log, stderr=log))
