import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile, rename, link, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BUNDLE = fileURLToPath(new URL('./runtime-bundle/', import.meta.url));
const ROLES = ['croupier-director', 'croupier-chat', 'croupier-operator', 'croupier-social', 'croupier-speech'];
const BEGIN = '<!-- BEGIN CROUPIER MANAGED RUNTIME -->';
const END = '<!-- END CROUPIER MANAGED RUNTIME -->';
const digest = (text) => createHash('sha256').update(text).digest('hex');
const normalized = (text) => text.replace(/\r\n/g, '\n');
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

async function regularText(file, missing = false) {
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 512 * 1024) {
      throw new Error('Runtime bundle requires a bounded regular file, not a symlink.');
    }
    const bytes = await readFile(file);
    const text = bytes.toString('utf8');
    if (!Buffer.from(text).equals(bytes)) throw new Error('Runtime bundle refuses to rewrite invalid UTF-8.');
    return text;
  } catch (error) {
    if (missing && error.code === 'ENOENT') return null;
    throw error;
  }
}

// Check each directory component before traversing it. No writes outside the
// configured state directory, including via a workspace/snapshot symlink.
async function managedDirectory(root, target) {
  if (target !== root && !inside(root, target)) throw new Error('Runtime bundle directory is outside managed state.');
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Runtime bundle state must be a real directory.');
  let current = root;
  for (const part of path.relative(root, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { await mkdir(current, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Runtime bundle refuses a linked or non-directory workspace.');
  }
}

async function immutableText(file, content) {
  const existing = await regularText(file, true);
  if (existing !== null) {
    if (existing !== content) throw new Error('Runtime bundle snapshot or backup was edited; refusing to overwrite it.');
    return;
  }
  const candidate = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(candidate, content, { flag: 'wx', mode: 0o600 });
    try { await link(candidate, file); } catch (error) {
      if (error.code !== 'EEXIST' || await regularText(file) !== content) throw error;
    }
  } finally {
    await unlink(candidate).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
}

export async function loadRuntimeBundle(bundleDir = DEFAULT_BUNDLE) {
  const manifest = JSON.parse(await regularText(path.join(bundleDir, 'manifest.json')));
  if (manifest.schemaVersion !== 1 || !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(manifest.version)
    || manifest.openclawVersion !== '2026.9.5'
    || JSON.stringify(Object.keys(manifest.roles || {}).sort()) !== JSON.stringify([...ROLES].sort())) {
    throw new Error('Invalid Croupier runtime bundle manifest.');
  }
  const names = new Set();
  for (const sources of Object.values(manifest.roles)) {
    if (!Array.isArray(sources) || sources.length < 1 || sources.length > 8) throw new Error('Invalid runtime role sources.');
    for (const source of sources) {
      if (typeof source !== 'string' || !/^(roles|knowledge)\/[a-z0-9-]+\.md$/.test(source)) {
        throw new Error('Invalid runtime bundle source path.');
      }
      names.add(source);
    }
  }
  const files = { 'manifest.json': `${JSON.stringify(manifest, null, 2)}\n` };
  for (const source of [...names].sort()) files[source] = normalized(await regularText(path.join(bundleDir, source)));
  const sha256 = digest(JSON.stringify(files));
  const snapshot = `${manifest.version}-${sha256}`;
  const blocks = {};
  for (const role of ROLES) {
    const body = `Croupier runtime package ${manifest.version}; SHA-256 ${sha256}.\n`
      + `Snapshot: .croupier-runtime/${snapshot}/. Edit personal instructions outside this managed block.\n\n`
      + manifest.roles[role].map((source) => files[source].trim()).join('\n\n') + '\n';
    if (body.length > (['croupier-director', 'croupier-social', 'croupier-speech'].includes(role) ? 4000 : 11000)) throw new Error('Runtime role context exceeds its compact budget.');
    blocks[role] = `${BEGIN}\n<!-- content-sha256: ${digest(body)} -->\n${body}${END}`;
  }
  return { version: manifest.version, openclawVersion: manifest.openclawVersion, sha256, snapshot, files, blocks };
}

// A verified self-contained hash makes reruns safe even if startup was stopped
// immediately after AGENTS was replaced. No separate mutable receipt is needed.
export function planManagedAgents(original, block) {
  if (original === null) return { next: `${block}\n`, status: 'installed' };
  const starts = original.split(BEGIN).length - 1;
  const ends = original.split(END).length - 1;
  if (!starts && !ends) return { next: `${block}\n\n${original}`, status: 'installed' };
  if (starts !== 1 || ends !== 1) return { status: 'conflict', reason: 'ambiguous_managed_block' };
  const start = original.indexOf(BEGIN);
  const end = original.indexOf(END);
  if (end < start) return { status: 'conflict', reason: 'ambiguous_managed_block' };
  const current = original.slice(start, end + END.length);
  const inner = normalized(current.slice(BEGIN.length, -END.length));
  const match = /^\n<!-- content-sha256: ([a-f0-9]{64}) -->\n([\s\S]*)$/.exec(inner);
  if (!match || digest(match[2]) !== match[1]) return { status: 'conflict', reason: 'managed_block_was_edited' };
  if (normalized(current) === block) return { next: original, status: 'current' };
  return { next: original.slice(0, start) + block + original.slice(end + END.length), status: 'updated' };
}

async function replaceAgents(file, original, next) {
  const candidate = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(candidate, next, { flag: 'wx', mode: 0o600 });
    if (await regularText(file, true) !== original) throw new Error('AGENTS changed during runtime sync; refusing to overwrite it.');
    if (original === null) await link(candidate, file);
    else await rename(candidate, file);
  } finally {
    await unlink(candidate).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
}

function injectionStatus(config, agent, length) {
  const defaults = config.agents?.defaults || {};
  const contextInjection = agent.contextInjection ?? defaults.contextInjection ?? 'always';
  const limit = (value, fallback) => Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  const maxChars = limit(agent.bootstrapMaxChars ?? defaults.bootstrapMaxChars, 20000);
  const totalChars = limit(agent.bootstrapTotalMaxChars ?? defaults.bootstrapTotalMaxChars, 60000);
  return {
    contextInjection,
    warning: contextInjection === 'never' ? 'context_injection_disabled'
      : length > Math.min(maxChars, totalChars) ? 'agents_context_may_be_truncated'
        : contextInjection === 'continuation-skip' ? 'fresh_session_recommended' : null,
  };
}

export async function syncRuntimeBundle(config, stateDir, { bundleDir = DEFAULT_BUNDLE } = {}) {
  const bundle = await loadRuntimeBundle(bundleDir);
  if (!path.isAbsolute(stateDir)) throw new Error('Runtime bundle state directory must be absolute.');
  const root = path.resolve(stateDir);
  const entries = config.agents?.entries || {};
  const workspaces = Object.entries(entries).filter(([, entry]) => typeof entry.workspace === 'string' && path.isAbsolute(entry.workspace))
    .map(([id, entry]) => ({ id, workspace: path.resolve(entry.workspace) }));
  const roles = [];
  for (const id of ROLES) {
    const agent = entries[id];
    if (!agent) { roles.push({ id, status: 'skipped', reason: 'role_not_configured' }); continue; }
    if (typeof agent.workspace !== 'string' || !path.isAbsolute(agent.workspace) || !inside(root, path.resolve(agent.workspace))) {
      roles.push({ id, status: 'skipped', reason: 'workspace_outside_managed_state' }); continue;
    }
    const workspace = path.resolve(agent.workspace);
    if (workspaces.some((other) => other.id !== id && (path.relative(other.workspace, workspace) === ''
      || inside(workspace, other.workspace) || inside(other.workspace, workspace)))) {
      roles.push({ id, status: 'skipped', reason: 'workspace_shared_or_nested' }); continue;
    }
    await managedDirectory(root, workspace);
    const agentsFile = path.join(workspace, 'AGENTS.md');
    const original = await regularText(agentsFile, true);
    const plan = planManagedAgents(original, bundle.blocks[id]);
    if (plan.status === 'conflict') { roles.push({ id, status: plan.status, reason: plan.reason }); continue; }
    const snapshotDir = path.join(workspace, '.croupier-runtime', bundle.snapshot);
    await managedDirectory(root, snapshotDir);
    for (const [name, text] of Object.entries(bundle.files)) {
      const target = path.join(snapshotDir, name);
      await managedDirectory(root, path.dirname(target));
      await immutableText(target, text);
    }
    if (plan.next !== original) {
      if (original !== null) {
        const backups = path.join(workspace, '.croupier-runtime', 'backups');
        await managedDirectory(root, backups);
        await immutableText(path.join(backups, `AGENTS.${digest(original)}.md`), original);
      }
      await replaceAgents(agentsFile, original, plan.next);
    }
    roles.push({ id, status: plan.status, ...injectionStatus(config, agent, plan.next.length) });
  }
  // Do not return config, workspace paths, AGENTS contents or environment values.
  return { version: bundle.version, sha256: bundle.sha256, openclawVersion: bundle.openclawVersion, roles };
}
