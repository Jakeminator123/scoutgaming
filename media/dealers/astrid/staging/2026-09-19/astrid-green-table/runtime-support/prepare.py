#!/usr/bin/env python3
"""Prepare a separate server/database around the current real game assets."""
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import json
import shutil

support = Path(__file__).resolve().parent
repo = next(p for p in support.parents if (p / 'web/server.mjs').is_file())
source = repo / 'web'
runtime = support.parent / 'runtime'
runtime.mkdir(exist_ok=True)
if runtime.is_symlink():
    raise SystemExit('Refusing a symlinked runtime directory')

public = runtime / 'public'
target = source / 'public'
if public.is_symlink():
    if public.resolve() != target.resolve():
        raise SystemExit('Existing public symlink points somewhere else')
elif public.exists():
    raise SystemExit('Refusing to replace an existing public directory')
else:
    public.symlink_to(target, target_is_directory=True)

copied = []
for path in sorted(source.glob('*.mjs')):
    destination = runtime / path.name
    if destination.is_symlink():
        raise SystemExit(f'Refusing a symlinked backend file: {path.name}')
    shutil.copy2(path, destination)
    copied.append({'file': path.name, 'sha256': sha256(path.read_bytes()).hexdigest()})

# The private SQLite files are created here only by the preview server.
# Never copy web/data or persist preview-session cookies in receipts.
(runtime / '.gitignore').write_text('*\n', encoding='utf8')
receipt = {
    'version': 1,
    'preparedAt': datetime.now(timezone.utc).isoformat(),
    'runtime': str(runtime.relative_to(repo)),
    'staticAssets': 'web/public via symlink; current actual game code',
    'backendFiles': copied,
    'databasePolicy': 'Fresh runtime/data only; no source database copied',
    'host': '127.0.0.1',
    'port': 4190,
    'guestAccess': True,
    'reviewURL': 'http://astridgreen.localhost:4190/?dealer=astrid&performance=staged&astridGreen=review',
}
(support / 'prepare-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf8')
print(f'Prepared {len(copied)} backend modules in {runtime}; no database copied.')
