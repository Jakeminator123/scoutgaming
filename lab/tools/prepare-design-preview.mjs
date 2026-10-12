import { createHash } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../packages/design-preview');
export async function prepareDesignPreview() {
  const hash = createHash('sha256').update(await readFile(resolve(root, 'package-lock.json'))).digest('hex');
  const marker = resolve(root, 'node_modules/.preview-lock');
  let installed = false;
  try {
    installed = (await readFile(marker, 'utf8')) === hash;
    await access(resolve(root, 'node_modules/esbuild/lib/main.js'));
  } catch { installed = false; }
  if (!installed) {
    // Use the active Node/npm installation. Static arguments; no user input enters the shell.
    const windows = process.platform === 'win32';
    const result = spawnSync(windows ? (process.env.ComSpec || 'cmd.exe') : 'npm',
      windows ? ['/d', '/s', '/c', 'npm ci --ignore-scripts --no-audit --no-fund'] : ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: root, stdio: 'inherit', windowsHide: true,
    });
    if (result.error || result.status !== 0) throw new Error('Design preview dependency installation failed.');
    await writeFile(marker, hash);
  }
  const built = spawnSync(process.execPath, [resolve(root, 'build.mjs')], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (built.error || built.status !== 0) throw new Error('Design preview build failed.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await prepareDesignPreview();
