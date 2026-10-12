import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from '../../../ops/vercel-entry/build.mjs';
import { platformConfiguration } from '../lib/platform-routing.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(app, '../..');

export async function preparePlatformUi({ env = process.env, output = app } = {}) {
  const configuration = platformConfiguration(env);
  if (!configuration) return {enabled: false};
  const runtime = join(output, 'runtime-ui');
  const generated = join(runtime, 'assets');
  await mkdir(runtime, {recursive: true});
  await build({origin: configuration.backendOrigin, frontendPreview: true, output: pathToFileURL(generated + '/')});
  const files = [];
  async function publish(directory, prefix = '') {
    for (const entry of await readdir(directory, {withFileTypes: true})) {
      const name = prefix + entry.name;
      if (entry.isDirectory()) { if (entry.name !== 'frontend-preview') await publish(join(directory, entry.name), name + '/'); continue; }
      if (!/\.(?:mjs|js|css|json)$/.test(name)) continue;
      let text = await readFile(join(directory, entry.name), 'utf8');
      if (name === 'blackjack-entry.mjs') text = await readFile(join(repo, 'web/public/blackjack-entry.mjs'), 'utf8');
      if (name === 'auth-modal.mjs') text = text.replace('/frontend-preview/blackjack/', '/blackjack');
      const target = join(output, 'public', name);
      await mkdir(dirname(target), {recursive: true}); await writeFile(target, text);
      files.push('/' + name);
    }
  }
  await publish(generated);
  // Distribute the exact shared compositor source used by Studio; no media is copied.
  for(const name of ['compositor.js','geometry.js']){
    const target=join(output,'public','composition-runtime',name);
    await mkdir(dirname(target),{recursive:true});
    await writeFile(target,await readFile(join(repo,'test-videoeditor/program/web',name)));
    files.push('/composition-runtime/'+name);
  }
  // Optional player styles are selected dynamically by the existing player.
  for (const entry of await readdir(join(repo, 'web/public'), {withFileTypes: true})) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    await writeFile(join(output, 'public', entry.name), await readFile(join(repo, 'web/public', entry.name)));
    if (!files.includes('/' + entry.name)) files.push('/' + entry.name);
  }
  for (const [target, source] of [['game.html', 'index.html'], ['blackjack.html', 'blackjack-entry.html']]) {
    await writeFile(join(runtime, target), await readFile(join(repo, 'web/public', source)));
  }
  await writeFile(join(runtime, 'manifest.json'), JSON.stringify({files: [...new Set(files)].sort(), mediaCopied: false, actualPlayback: false}, null, 2));
  return {enabled: true, files};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await preparePlatformUi();
  console.log(result.enabled ? 'Vercel player UI prepared; native administration remains in Studio.' : 'Existing landing-only build retained.');
}
