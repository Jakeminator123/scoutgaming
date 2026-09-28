import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

// Disposable server copies keep the repository's sibling-module layout. Copy
// source modules only, never credentials, persisted settings or runtime data.
export async function copyOpenClawRuntime(root) {
  const source = new URL('../../open-claw/lab/src/', import.meta.url);
  const target = join(root, 'open-claw/lab/src');
  await mkdir(target, { recursive: true });
  for (const file of await readdir(source)) if (file.endsWith('.mjs')) {
    await copyFile(new URL(file, source), join(target, file));
  }
}
