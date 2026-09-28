import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareContainerUser } from '../container-entry.mjs';

test('container changes only its exact disk root, then drops all supplementary groups and root', async () => {
  const calls = []; let uid = 0, gid = 0;
  const fs = {
    lstat: async path => { assert.equal(path, '/var/data'); return { isDirectory: () => true, isSymbolicLink: () => false }; },
    realpath: async path => path,
    chown: async (...args) => calls.push(['chown', ...args]),
    chmod: async (...args) => calls.push(['chmod', ...args]),
  };
  const proc = { getuid: () => uid, getgid: () => gid,
    setgroups: value => calls.push(['groups', value]),
    setgid: value => { gid = value; calls.push(['gid', value]); },
    setuid: value => { uid = value; calls.push(['uid', value]); } };
  await prepareContainerUser({ CROUPIER_CLOUD_DATA_ROOT: '/var/data' }, { fs, proc });
  assert.deepEqual(calls, [['chown', '/var/data', 1000, 1000], ['chmod', '/var/data', 0o700], ['groups', []], ['gid', 1000], ['uid', 1000]]);
  calls.length = 0;
  await prepareContainerUser({ CROUPIER_CLOUD_DATA_ROOT: '/var/data' }, { fs, proc });
  assert.deepEqual(calls, []);
  for (const path of ['/', '/app', '/var/data/..', undefined]) {
    await assert.rejects(prepareContainerUser({ CROUPIER_CLOUD_DATA_ROOT: path }, { fs, proc }));
  }
  await assert.rejects(prepareContainerUser({ CROUPIER_CLOUD_DATA_ROOT: '/var/data' }, { fs: { ...fs, realpath: async () => '/other' }, proc }));
});
