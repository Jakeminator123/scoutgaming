#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPrivateConnection, probeConnections, startIsolatedConnection } from '../open-claw/lab/deploy/local-connection.mjs';
import { validateProject } from '../lab/lib/studio-model.mjs';
import { createProjectStore } from '../lab/lib/project-store.mjs';
import profile from './profile.json' with { type: 'json' };

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '..');
export async function prepareProject(dataDir = join(directory, 'data')) {
  const snapshot = await readFile(join(directory, 'project.snapshot.json'), 'utf8');
  validateProject(JSON.parse(snapshot));
  await mkdir(dataDir, { recursive: true });
  try { await writeFile(join(dataDir, 'project.json'), snapshot, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  // A broken saved project is reported, never silently replaced by the snapshot.
  const saved = validateProject(JSON.parse(await readFile(join(dataDir, 'project.json'), 'utf8')));
  // Add deliberately registered lane clips without replacing the operator's
  // existing modes, timings, descriptions or base weights. Save through the
  // normal revision/history path so upgrading an older lane is reversible.
  if (saved.idlePolicy) {
    const defaults = JSON.parse(snapshot).idlePolicy.variants;
    const draft = structuredClone(saved);
    for (const variant of defaults) {
      const existing = draft.idlePolicy.variants.find(item => item.videoId === variant.videoId);
      if (!existing) draft.idlePolicy.variants.push(variant);
      else if (!Object.hasOwn(existing, 'description')) existing.description = variant.description;
    }
    if (JSON.stringify(draft) !== JSON.stringify(saved)) await createProjectStore(dataDir).save(draft, saved.revision);
  }
  return dataDir;
}
function openBrowser(url) {
  const [command, args] = process.platform === 'win32'
    ? ['powershell.exe', ['-NoProfile', '-Command', `Start-Process '${url}'`]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  const child = spawn(command, args, { windowsHide: true, stdio: 'ignore' });
  child.on('error', () => console.log(`Öppna ${url} i webbläsaren.`));
}
async function buildLab(session) {
  console.log('Bygger Lissabon-labbet…');
  const child = spawn(process.execPath, [join(root, 'lab/node_modules/next/dist/bin/next'), 'build', '--webpack'], {
    cwd: join(root, 'lab'), windowsHide: true, stdio: 'inherit', env: session.environment({ ...process.env, NEXT_TELEMETRY_DISABLED: '1' }),
  });
  try { session.trackChild(child); } catch (error) { child.kill(); throw error; }
  await new Promise((yes, no) => { child.once('error', no); child.once('exit', code => code === 0 ? yes() : no(new Error(`Labbbygget misslyckades (${code}). Kör npm --prefix lab ci om beroenden saknas.`))); });
}
export async function main(args = process.argv.slice(2)) {
  if (args.some(arg => !['--check', '--no-open', '--skip-build', '--astrid-camera'].includes(arg))) throw new Error('Använd --check, --no-open, --skip-build eller --astrid-camera.');
  const url = `http://127.0.0.1:${profile.labPort}/lissabon`;
  if (args.includes('--check')) {
    const { configuration, report } = loadPrivateConnection({ generatedSpeech: true });
    console.log(JSON.stringify({ lane: profile.id, report, probe: await probeConnections(configuration) }, null, 2));
    return;
  }
  const running = await fetch(`http://127.0.0.1:${profile.labPort}/api/health`, { signal: AbortSignal.timeout(2000) }).then(r => r.json()).catch(() => null);
  if (running?.service === 'croupier-next-studio' && running.streamLane === profile.id) {
    console.log(`Lissabon kör redan: ${url}`);
    if (args.includes('--astrid-camera')) console.log('Kameraflaggan ändras bara vid en ny start. Den körande sessionen ändrades inte.');
    return;
  }
  if (running) throw new Error(`Port ${profile.labPort} används av ett annat labb. Stoppa dess startprocess först; ingen process stängs automatiskt.`);
  const studioDataDir = join(directory, 'data');
  const fixture = await startIsolatedConnection({ ...profile, studioDataDir, streamLane: profile.id,
    astridCamera: args.includes('--astrid-camera'),
    prepare: async session => {
      await prepareProject(studioDataDir);
      if (!args.includes('--skip-build')) await buildLab(session);
    },
  });
  console.log(`Lissabon redo: ${url}\nTryck Anslut för att öppna Astrid och följa samma ström.\nCtrl+C stoppar båda servrarna. Sparade klippval finns kvar i lissabon/data.`);
  const stop = async () => { await fixture.stop(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  if (!args.includes('--no-open')) openBrowser(url);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
