import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gatewayConfig } from './gateway-config.mjs';
import { prepareGatewayRuntime } from './start-gateway.mjs';
import { loadRuntimeBundle, planManagedAgents, syncRuntimeBundle } from './runtime-bundle.mjs';

const sourceDir = fileURLToPath(new URL('./runtime-bundle/', import.meta.url));
const roles = ['croupier-director', 'croupier-chat', 'croupier-operator', 'croupier-social'];
const sha = (text) => createHash('sha256').update(text).digest('hex');

async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'croupier-runtime-bundle-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const stateDir = path.join(dir, 'state');
  await mkdir(stateDir);
  const env = { OPENCLAW_STATE_DIR: stateDir, OPENCLAW_CONFIG_PATH: path.join(stateDir, 'openclaw.json'),
    OPENCLAWAPI_KEY: 'fake-gateway-secret-runtime-test', OPENCLAW_MODEL_API_KEY: 'fake-provider-secret-runtime-test' };
  const config = gatewayConfig(env);
  return { dir, stateDir, env, config, workspace: config.agents.entries['croupier-chat'].workspace };
}

test('package provides real compact context, with full source index only for chat/operator', async () => {
  const bundle = await loadRuntimeBundle();
  assert.match(bundle.sha256, /^[a-f0-9]{64}$/);
  assert.equal(bundle.openclawVersion, '2026.9.5');
  assert.ok(bundle.blocks['croupier-director'].length < 2400);
  assert.match(bundle.blocks['croupier-director'], /ONLY JSON.*exactly requestId, catalogRevision, variantId/);
  assert.doesNotMatch(bundle.blocks['croupier-director'], /https:\/\/docs\.openclaw\.ai/);
  assert.match(bundle.blocks['croupier-social'], /choose_social_response/);
  assert.match(bundle.blocks['croupier-social'], /NOT an installed MCP tool/);
  assert.match(bundle.blocks['croupier-social'], /idle\.ready/);
  assert.ok(bundle.blocks['croupier-social'].length < 2400);
  for (const role of ['croupier-chat', 'croupier-operator']) {
    assert.match(bundle.blocks[role], /https:\/\/docs\.openclaw\.ai\/llms\.txt/);
    assert.match(bundle.blocks[role], /not vector search, embeddings/);
    assert.match(bundle.blocks[role], /seven physical boxes/);
    assert.match(bundle.blocks[role], /not.*live documentation|not a live docs fetch/i);
    assert.ok(bundle.blocks[role].length < 11000);
  }
});

test('first sync installs versioned files and injected AGENTS content without changing config/tools', async (t) => {
  const { stateDir, config, env } = await fixture(t);
  const before = structuredClone(config);
  const bundle = await loadRuntimeBundle();
  const status = await syncRuntimeBundle(config, stateDir);
  assert.deepEqual(config, before);
  assert.deepEqual(status.roles.map((role) => role.status), roles.map(() => 'installed'));
  for (const id of roles) {
    assert.deepEqual(config.agents.entries[id].tools.deny, ['*']);
    const workspace = config.agents.entries[id].workspace;
    assert.equal(await readFile(path.join(workspace, 'AGENTS.md'), 'utf8'), `${bundle.blocks[id]}\n`);
    assert.equal(await readFile(path.join(workspace, '.croupier-runtime', bundle.snapshot, 'manifest.json'), 'utf8'), bundle.files['manifest.json']);
  }
  const publicOutput = JSON.stringify(status) + Object.values(bundle.files).join('');
  assert.equal(publicOutput.includes(env.OPENCLAWAPI_KEY), false);
  assert.equal(publicOutput.includes(env.OPENCLAW_MODEL_API_KEY), false);
  assert.equal(JSON.stringify(status).includes(stateDir), false);
});

test('human AGENTS bytes are backed up and preserved; SOUL and IDENTITY are untouched', async (t) => {
  const { stateDir, config, workspace } = await fixture(t);
  await mkdir(workspace, { recursive: true });
  const original = '\uFEFF# Min agent\r\nSvenska ord: blåbär.\r\n';
  const soul = '# Personlighet\r\nEgen text.\r\n';
  const identity = '# Namn\nMin handredigerade identitet.\n';
  await writeFile(path.join(workspace, 'AGENTS.md'), original);
  await writeFile(path.join(workspace, 'SOUL.md'), soul);
  await writeFile(path.join(workspace, 'IDENTITY.md'), identity);
  await syncRuntimeBundle(config, stateDir);
  const installed = await readFile(path.join(workspace, 'AGENTS.md'), 'utf8');
  assert.ok(installed.endsWith(original));
  assert.equal(await readFile(path.join(workspace, '.croupier-runtime', 'backups', `AGENTS.${sha(original)}.md`), 'utf8'), original);
  assert.equal(await readFile(path.join(workspace, 'SOUL.md'), 'utf8'), soul);
  assert.equal(await readFile(path.join(workspace, 'IDENTITY.md'), 'utf8'), identity);
  const result = await syncRuntimeBundle(config, stateDir);
  assert.equal(result.roles.find((role) => role.id === 'croupier-chat').status, 'current');
  assert.equal(await readFile(path.join(workspace, 'AGENTS.md'), 'utf8'), installed);
  assert.equal((await readdir(path.join(workspace, '.croupier-runtime', 'backups'))).length, 1);
});

test('package upgrade replaces only managed text and preserves both surrounding human regions', async (t) => {
  const { dir, stateDir, config, workspace } = await fixture(t);
  await syncRuntimeBundle(config, stateDir);
  const old = await readFile(path.join(workspace, 'AGENTS.md'), 'utf8');
  const human = `# Extra instruction above\r\n${old}\r\n# Extra instruction below\r\n`;
  await writeFile(path.join(workspace, 'AGENTS.md'), human);
  const bundleDir = path.join(dir, 'next-bundle');
  await cp(sourceDir, bundleDir, { recursive: true });
  const manifestPath = path.join(bundleDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.version = '2026-09-20.3';
  await writeFile(manifestPath, JSON.stringify(manifest));
  const result = await syncRuntimeBundle(config, stateDir, { bundleDir });
  assert.equal(result.roles.find((role) => role.id === 'croupier-chat').status, 'updated');
  const next = await readFile(path.join(workspace, 'AGENTS.md'), 'utf8');
  assert.ok(next.startsWith('# Extra instruction above\r\n'));
  assert.ok(next.endsWith('\n\r\n# Extra instruction below\r\n'));
  assert.match(next, /package 2026-09-20\.3/);
  assert.equal(await readFile(path.join(workspace, '.croupier-runtime', 'backups', `AGENTS.${sha(human)}.md`), 'utf8'), human);
  assert.equal((await readdir(path.join(workspace, '.croupier-runtime'))).filter((name) => name.startsWith('2026-')).length, 2);
});

test('hand-edited managed content is a reported conflict, not overwritten or silently declared current', async (t) => {
  const { stateDir, config, workspace } = await fixture(t);
  await syncRuntimeBundle(config, stateDir);
  const file = path.join(workspace, 'AGENTS.md');
  const edited = (await readFile(file, 'utf8')).replace('Reply in simple Swedish', 'Reply in Icelandic');
  await writeFile(file, edited);
  const status = await syncRuntimeBundle(config, stateDir);
  assert.deepEqual(status.roles.find((role) => role.id === 'croupier-chat'), {
    id: 'croupier-chat', status: 'conflict', reason: 'managed_block_was_edited',
  });
  assert.equal(await readFile(file, 'utf8'), edited);
});

test('ambiguous markers are preserved and line ending changes alone are harmless', async () => {
  const bundle = await loadRuntimeBundle();
  const block = bundle.blocks['croupier-chat'];
  const crlf = `# Human\r\n${block.replace(/\n/g, '\r\n')}\r\n`;
  assert.deepEqual(planManagedAgents(crlf, block), { next: crlf, status: 'current' });
  for (const bad of ['<!-- BEGIN CROUPIER MANAGED RUNTIME -->', `${block}\n${block}`, '<!-- END CROUPIER MANAGED RUNTIME -->']) {
    assert.equal(planManagedAgents(bad, block).status, 'conflict');
  }
});

test('sync does not create missing roles or touch unrelated agent workspaces', async (t) => {
  const { stateDir, config } = await fixture(t);
  delete config.agents.entries['croupier-chat'];
  config.agents.entries['personal-agent'] = { workspace: path.join(stateDir, 'personal') };
  const before = JSON.stringify(config);
  const status = await syncRuntimeBundle(config, stateDir);
  assert.deepEqual(status.roles.find((role) => role.id === 'croupier-chat'), {
    id: 'croupier-chat', status: 'skipped', reason: 'role_not_configured',
  });
  await assert.rejects(readFile(path.join(stateDir, 'personal', 'AGENTS.md')), { code: 'ENOENT' });
  assert.equal(JSON.stringify(config), before);
});

test('custom external or shared/nested workspaces are reported and not rewritten', async (t) => {
  const { dir, stateDir, config, workspace } = await fixture(t);
  delete config.agents.entries['croupier-social'];
  config.agents.entries['croupier-operator'].workspace = path.join(dir, 'external');
  config.agents.entries['croupier-director'].workspace = path.join(workspace, 'nested');
  const status = await syncRuntimeBundle(config, stateDir);
  assert.equal(status.roles.find((role) => role.id === 'croupier-operator').reason, 'workspace_outside_managed_state');
  assert.equal(status.roles.find((role) => role.id === 'croupier-chat').reason, 'workspace_shared_or_nested');
  assert.equal(status.roles.find((role) => role.id === 'croupier-director').reason, 'workspace_shared_or_nested');
  assert.deepEqual(await readdir(stateDir), []);
  config.agents.entries['croupier-director'].workspace = process.platform === 'win32' ? workspace.toUpperCase() : workspace;
  const alias = await syncRuntimeBundle(config, stateDir);
  assert.equal(alias.roles.find((role) => role.id === 'croupier-chat').reason, 'workspace_shared_or_nested');
  assert.equal(alias.roles.find((role) => role.id === 'croupier-director').reason, 'workspace_shared_or_nested');
  assert.deepEqual(await readdir(stateDir), []);
});

test('partially copied snapshot can resume; edited immutable snapshot is not overwritten', async (t) => {
  const { stateDir, config, workspace } = await fixture(t);
  const bundle = await loadRuntimeBundle();
  const snapshot = path.join(workspace, '.croupier-runtime', bundle.snapshot);
  await mkdir(snapshot, { recursive: true });
  const file = path.join(snapshot, 'manifest.json');
  await writeFile(file, bundle.files['manifest.json']);
  // Interrupted writers only leave unpublished temporary files. A final
  // snapshot name is linked after its candidate has been completely written.
  await mkdir(path.join(snapshot, 'roles'));
  await writeFile(path.join(snapshot, 'roles', 'croupier-chat.md.interrupted.tmp'), 'partial');
  await syncRuntimeBundle(config, stateDir);
  assert.equal(await readFile(path.join(snapshot, 'roles', 'croupier-chat.md'), 'utf8'), bundle.files['roles/croupier-chat.md']);
  const agentsBefore = await readFile(path.join(workspace, 'AGENTS.md'), 'utf8');
  await writeFile(file, 'manually edited snapshot');
  await assert.rejects(syncRuntimeBundle(config, stateDir), /snapshot or backup was edited/);
  assert.equal(await readFile(file, 'utf8'), 'manually edited snapshot');
  assert.equal(await readFile(path.join(workspace, 'AGENTS.md'), 'utf8'), agentsBefore);
});

test('a workspace symlink/junction cannot redirect AGENTS writes outside state', async (t) => {
  const { dir, stateDir, config, workspace } = await fixture(t);
  const external = path.join(dir, 'not-managed');
  await mkdir(external);
  await writeFile(path.join(external, 'AGENTS.md'), 'Human external agent');
  await mkdir(path.dirname(workspace), { recursive: true });
  await symlink(external, workspace, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(syncRuntimeBundle(config, stateDir), /linked or non-directory workspace/);
  assert.equal(await readFile(path.join(external, 'AGENTS.md'), 'utf8'), 'Human external agent');
  assert.deepEqual(await readdir(external), ['AGENTS.md']);
});

test('manifest source traversal is rejected and CRLF checkout produces the same package hash', async (t) => {
  const { dir } = await fixture(t);
  const bundleDir = path.join(dir, 'test-bundle');
  await cp(sourceDir, bundleDir, { recursive: true });
  const initial = await loadRuntimeBundle(bundleDir);
  for (const name of Object.keys(initial.files).filter((name) => name.endsWith('.md'))) {
    await writeFile(path.join(bundleDir, name), initial.files[name].replace(/\n/g, '\r\n'));
  }
  assert.equal((await loadRuntimeBundle(bundleDir)).sha256, initial.sha256);
  const manifestPath = path.join(bundleDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.roles['croupier-chat'] = ['../../outside.md'];
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(loadRuntimeBundle(bundleDir), /source path/);
});

test('manual injection mode and low budgets are preserved but explicitly surfaced', async (t) => {
  const { stateDir, config } = await fixture(t);
  config.agents.entries['croupier-director'].contextInjection = 'never';
  config.agents.entries['croupier-chat'].bootstrapMaxChars = 100;
  config.agents.entries['croupier-operator'].contextInjection = 'continuation-skip';
  const before = structuredClone(config);
  const status = await syncRuntimeBundle(config, stateDir);
  assert.deepEqual(config, before);
  assert.deepEqual(status.roles.map((role) => role.warning), [
    'context_injection_disabled', 'agents_context_may_be_truncated', 'fresh_session_recommended', null,
  ]);
});

test('startup sync runs even when an existing native config is reused byte-for-byte', async (t) => {
  const { env, stateDir, config, workspace } = await fixture(t);
  const original = JSON.stringify(config);
  await writeFile(env.OPENCLAW_CONFIG_PATH, original);
  const result = await prepareGatewayRuntime(env, { validateConfig: async () => {} });
  assert.equal(result.action, 'reuse');
  assert.equal(result.bundle.roles.find((role) => role.id === 'croupier-chat').status, 'installed');
  assert.equal(await readFile(env.OPENCLAW_CONFIG_PATH, 'utf8'), original);
  assert.match(await readFile(path.join(workspace, 'AGENTS.md'), 'utf8'), /Croupier lab chat/);
  assert.equal((await prepareGatewayRuntime(env, { validateConfig: async () => {} })).bundle.roles[0].status, 'current');
  assert.ok((await readdir(stateDir)).includes('workspaces'));
});

test('gateway image copies both synchronizer and versioned runtime sources', async () => {
  const dockerfile = await readFile(new URL('./Dockerfile.gateway', import.meta.url), 'utf8');
  assert.match(dockerfile, /COPY.*deploy\/runtime-bundle\.mjs.*\/opt\/croupier-gateway\//);
  assert.match(dockerfile, /COPY.*deploy\/runtime-bundle\/.*\/opt\/croupier-gateway\/runtime-bundle\//);
  assert.match(dockerfile, /2026\.9\.5@sha256:/);
});
