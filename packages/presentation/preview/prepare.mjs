import {cp, mkdir, readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
export const isLanePreview = env => env.VERCEL_ENV === 'preview' && env.VERCEL_GIT_COMMIT_REF === 'test-video-jakob';

export async function prepareLanePreview({env = process.env, output} = {}) {
  if (!isLanePreview(env)) return {enabled: false};
  if (!output) throw Error('An explicit frontend output directory is required.');
  const site = join(root, 'site');
  const hashes = JSON.parse(await readFile(join(site, 'media-hashes.json'), 'utf8'));
  const files = (await readdir(join(site, 'media'))).sort();
  if (JSON.stringify(files) !== JSON.stringify(Object.keys(hashes).sort())) throw Error('Unexpected preview media.');
  for (const name of files) {
    if (!/^[a-f0-9]{64}\.(mp4|webp|png)$/.test(name)) throw Error('Only reviewed preview media are published.');
    const digest = createHash('sha256').update(await readFile(join(site, 'media', name))).digest('hex');
    if (digest !== hashes[name]) throw Error('Preview media hash mismatch: ' + name);
  }
  const dest = resolve(output, 'public/test');
  await mkdir(dest, {recursive: true});
  await cp(site, dest, {recursive: true});
  for (const filename of ['player.js', 'geometry.js', 'compositor.js']) {
    await cp(join(root, '../compositor', filename), join(dest, filename));
  }
  return {enabled: true, mediaFiles: files.length};
}
