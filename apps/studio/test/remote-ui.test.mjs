import test from 'node:test';
import assert from 'node:assert/strict';
import {remoteUiConfiguration, remoteUiInitialData, assertRemoteUiPage, authorizeRemoteUi} from '../lib/remote-ui.mjs';

const env = {CROUPIER_LAB_REMOTE_UI: '1', CROUPIER_LAB_BASE_PATH: '/studio', CROUPIER_PUBLIC_ORIGIN: 'https://preview.example.test',
  CROUPIER_BACKEND_ORIGIN: 'https://isolated.onrender.com', CROUPIER_LAB_UI_ORIGIN: 'https://lab-ui.vercel.app', CROUPIER_VERCEL_INGRESS_SECRET: 'isolated-remote-ui-secret-'.repeat(3)};
const config = remoteUiConfiguration(env);
const request = () => new Request(config.publicOrigin + '/studio/activity', {headers: {host: 'preview.example.test', cookie: 'lab_session=isolated'}});

test('remote Lab UI reads the saved backend revision and never substitutes a local project', async () => {
  assert.equal(remoteUiConfiguration({}), null);
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(url); assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.cookie, 'lab_session=isolated');
    assert.equal(options.headers['x-croupier-vercel-secret'], config.secret);
    if (url.endsWith('/session')) return Response.json({authorized: true});
    if (url.endsWith('/project')) return Response.json({project: {revision: 'saved-42'}, status: {provider: 'fixture'}});
    return Response.json({videos: []});
  };
  const result = await remoteUiInitialData(request(), {config, fetchImpl});
  assert.equal(result.project.revision, 'saved-42'); assert.equal(calls.length, 3);
  let unauthorizedCalls = 0;
  await assert.rejects(remoteUiInitialData(request(), {config, fetchImpl: async () => {unauthorizedCalls++; return new Response(null, {status: 401});}}), error => error.statusCode === 401);
  assert.equal(unauthorizedCalls, 1, 'revoked identities must not receive a project or video inventory');
  await assert.rejects(remoteUiInitialData(request(), {config, fetchImpl: async () => {throw Error('offline');}}), error => error.statusCode === 503);
  await assert.rejects(authorizeRemoteUi(request(), {config, fetchImpl: async () => Response.json({authorized: false})}), error => error.statusCode === 401);
});

test('remote Lab UI rejects actions, iframe embedding, unexpected hosts and cross-site RSC', () => {
  assert.throws(() => remoteUiConfiguration({...env, CROUPIER_LAB_BASE_PATH: ''}));
  assert.doesNotThrow(() => assertRemoteUiPage(request(), config));
  assert.doesNotThrow(() => assertRemoteUiPage(new Request(config.zoneOrigin + '/studio', {headers: {host: 'lab-ui.vercel.app', origin: config.publicOrigin}}), config));
  for (const headers of [{host: 'evil.example.test'}, {host: 'preview.example.test', origin: 'https://evil.example.test'},
    {host: 'preview.example.test', 'sec-fetch-dest': 'iframe'}, {host: 'preview.example.test', 'next-action': 'id'},
    {host: 'preview.example.test', 'sec-fetch-site': 'cross-site', 'sec-fetch-dest': 'empty'}]) {
    assert.throws(() => assertRemoteUiPage(new Request(config.publicOrigin + '/studio', {headers}), config), error => error.statusCode === 403);
  }
});
