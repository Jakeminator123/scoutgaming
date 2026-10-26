import { watch } from 'node:fs';
import { access, lstat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// Watch source directories, never the repository, app root or dependency tree.
// Package roots contain shared browser helpers; their server folders are separate.
export const designPreviewWatchRoots = Object.freeze([
  { path: 'apps/studio/client', recursive: false },
  ...['admin', 'lobby', 'runtime'].map(name => ({ path: `apps/studio/client/${name}`, recursive: true })),
  ...['components', 'lib', 'policies', 'app/fonts'].map(name => ({ path: `apps/studio/${name}`, recursive: true })),
  ...['navigation', 'player-catalog', 'shared', 'director', 'presentation', 'operators', 'studio-access', 'studio-registry']
    .map(name => ({ path: `packages/${name}`, recursive: false })),
  // Pure registry validators are also imported by the Admin browser bundle.
  { path: 'packages/studio-registry/server', recursive: false },
  ...['presentation/contracts', 'presentation/runtime', 'operators/contracts']
    .map(name => ({ path: `packages/${name}`, recursive: true })),
]);

const ignoredDirectories = new Set([
  'node_modules', 'test', 'tests', '__tests__', 'coverage', 'dist', 'build',
  'design-preview-build', 'preview-build', 'data', 'media', 'arkiv', 'secrets',
]);
export function isDesignPreviewSource(path) {
  if (typeof path !== 'string' || !path || isAbsolute(path)) return false;
  const parts = path.replaceAll('\\', '/').split('/');
  if (parts.some(part => !part || part.startsWith('.') || ignoredDirectories.has(part))) return false;
  const name = parts.at(-1);
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name) || /^(?:secrets?|credentials)(?:\.|$)/i.test(name) || /\.local\./.test(name)) return false;
  // Directory creation/removal can arrive before events for its new source files.
  return !extname(name) || /\.(?:[cm]?[jt]sx?|css|json|html|svg|png|jpe?g|webp|gif|ico|mp4|woff2?)$/i.test(name);
}

function runBuild(command, args, cwd, stdio) {
  return new Promise(accept => {
    let child;
    try { child = spawn(command, args, { cwd, stdio, windowsHide: true, shell: false }); }
    catch (error) { accept({ code: null, signal: null, error }); return; }
    let error;
    child.once('error', cause => { error = cause; });
    // close follows error/exit and includes the lifetime of the child's stdio.
    child.once('close', (code, signal) => accept({ code, signal, ...(error ? { error } : {}) }));
  });
}

export async function watchDesignPreview({
  repoRoot = repositoryRoot,
  roots = designPreviewWatchRoots,
  debounceMs = 200,
  command = process.execPath,
  args = [resolve(repoRoot, 'apps/studio/client/build.mjs')],
  cwd = resolve(repoRoot, 'apps/studio/client'),
  stdio = ['ignore', 'inherit', 'inherit'],
  onEvent = () => {},
} = {}) {
  if (!Number.isFinite(debounceMs) || debounceMs < 0) throw Error('Invalid rebuild debounce.');
  const watchers = [];
  let timer, watchError, building = false, dirty = false, stopped = false, first = true;
  let acceptReady, acceptClosed;
  const ready = new Promise(accept => { acceptReady = accept; });
  const closed = new Promise(accept => { acceptClosed = accept; });

  function close() {
    stopped = true; dirty = false;
    clearTimeout(timer);
    for (const watcher of watchers) watcher.close();
    // Let the one owned build (and its compiler children) finish naturally.
    // No detached processes, shell or platform-specific process-tree killing.
    if (!building) acceptClosed();
    return closed;
  }
  function requestBuild() {
    if (stopped) return;
    dirty = true;
    if (building) return;
    clearTimeout(timer);
    timer = setTimeout(build, debounceMs);
  }
  function build() {
    if (stopped || building) return;
    building = true; dirty = false;
    clearTimeout(timer);
    onEvent({ type: 'build-start' });
    void runBuild(command, args, cwd, stdio).then(result => {
      building = false;
      onEvent({ type: 'build-end', ...result });
      if (first) { first = false; acceptReady(result); }
      if (stopped) acceptClosed();
      else if (dirty) requestBuild();
    });
  }

  try {
    for (const entry of roots) {
      const path = resolve(repoRoot, entry.path), inside = relative(repoRoot, path);
      if (!inside || inside.startsWith('..') || isAbsolute(inside)) throw Error('Watch root must be inside the repository.');
      const info = await lstat(path).catch(error => {
        if (error.code === 'ENOENT') return null;
        throw error;
      });
      if (stopped) throw watchError;
      if (!info) continue;
      if (!info.isDirectory() || info.isSymbolicLink()) throw Error(`Watch root is not a source directory: ${entry.path}`);
      const watcher = watch(path, { recursive: entry.recursive === true }, (_event, filename) => {
        // Missing filenames are an fs.watch platform limitation; rebuild conservatively.
        if (filename === null || isDesignPreviewSource(filename.toString())) requestBuild();
      });
      watcher.on('error', error => { watchError = error; onEvent({ type: 'watch-error', error }); void close(); });
      watchers.push(watcher);
    }
    if (!watchers.length) throw Error('No client source directories are available to watch.');
  } catch (error) {
    await close();
    throw error;
  }
  onEvent({ type: 'watch-start', directories: watchers.length });
  build();
  return { ready, closed, close };
}

export async function main(args = process.argv.slice(2)) {
  if (args.length) throw Error('Usage: node apps/studio/tools/watch-design-preview.mjs');
  const client = resolve(repositoryRoot, 'apps/studio/client');
  try {
    await Promise.all(['build.mjs', 'node_modules/esbuild/lib/main.js', 'node_modules/typescript/bin/tsc']
      .map(path => access(resolve(client, path))));
  } catch {
    throw Error('Klientberoenden saknas. Förbered dem med node apps/studio/tools/prepare-design-preview.mjs först. Bevakaren installerar ingenting.');
  }
  let failed = false;
  const watcher = await watchDesignPreview({ onEvent(event) {
    if (event.type === 'watch-start') console.log('Bevakar klientkällor. Spara filen och uppdatera webbläsaren efter ett godkänt bygge. Osparade utkast laddas aldrig om automatiskt.');
    if (event.type === 'build-start') console.log('Bygger Admin/Lobby-klienten…');
    if (event.type === 'build-end') {
      if (event.code === 0) console.log('Klientbygget är klart. Uppdatera webbläsaren när dina utkast är sparade.');
      else console.error(`Klientbygget misslyckades (${event.error?.message ?? event.signal ?? event.code}). Bevakningen fortsätter; nästa ändring försöker igen.`);
    }
    if (event.type === 'watch-error') { failed = true; console.error('Källbevakningen stoppades: ' + event.error.message); }
  } });
  const stop = () => {
    console.log('Stoppar bevakningen. Ett pågående klientbygge får avslutas.');
    void watcher.close();
  };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try { await watcher.closed; }
  finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
