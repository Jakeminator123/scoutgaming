import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSearchService, createSearchServer, openAiSearchKey, SEARCH_POLICY } from './companion-search-server.mjs';
const id = n => n.toString(16).padStart(64, '0');
const response = () => Response.json({ output: [
  { type: 'web_search_call', status: 'completed' },
  { type: 'message', content: [{ type: 'output_text', text: 'A public fact.', annotations: [
    { type: 'url_citation', title: 'Unsafe', url: 'javascript:bad()' },
    { type: 'url_citation', title: 'Source', url: 'https://example.com/news' },
  ] }] },
] });

test('fixed search request, durable 5 SEK rolling budget, restart/idempotency and failure reservations', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'companion-search-')); let calls = 0, time = Date.parse('2026-09-21T04:00:00Z');
  const options = { directory, key: 'fixture-model-key', now: () => time, fetchImpl: async (url, options) => {
    calls++; assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer fixture-model-key');
    const body = JSON.parse(options.body); assert.equal(body.model, SEARCH_POLICY.model); assert.equal(body.max_tool_calls, 1);
    assert.equal(body.max_output_tokens, 512); assert.equal(body.store, false); assert.equal(body.service_tier, 'default');
    assert.deepEqual(body.tools, [{ type: 'web_search', search_context_size: 'low' }]);
    return calls === 2 ? new Response('', { status: 500 }) : response();
  } };
  let service = createSearchService(options);
  t.after(async () => { service.close(); await rm(directory, { recursive: true, force: true }); });
  const request = { id: id(1), query: 'Public query' };
  const [a, b] = await Promise.all([service.search(request), service.search(request)]);
  assert.deepEqual(a, b); assert.equal(calls, 1); assert.equal(a.results.length, 1); assert.equal(a.costSek, .5);
  assert.equal((await service.search({ ...request, query: 'Changed' })).status, 'request_conflict');
  for (let i = 2; i <= 6; i++) await service.search({ id: id(i), query: 'Public query' });
  service.close(); service = createSearchService(options);
  assert.deepEqual(await service.search(request), a); assert.equal(calls, 6);
  for (let i = 7; i <= 10; i++) await service.search({ id: id(i), query: 'Public query' });
  assert.equal((await service.search({ id: id(11), query: 'Public query' })).status, 'hourly_limit'); assert.equal(calls, 10);
  time += 3600001;
  assert.equal((await service.search({ id: id(11), query: 'Public query' })).status, 'searched');
  time = Date.parse(SEARCH_POLICY.pricingValidUntil);
  assert.equal((await service.search({ id: id(12), query: 'Public query' })).status, 'pricing_review_required'); assert.equal(calls, 11);
});

test('search endpoint authenticates and rejects browser/custom budget requests before spending', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'companion-search-http-')); let calls = 0;
  const server = createSearchServer({ directory, token: 'fixture-gateway', key: 'fixture-model', now: () => Date.parse('2026-09-21'), fetchImpl: async () => { calls++; return response(); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${server.address().port}/search`;
  const body = { id: id(1), query: 'Public query' };
  const post = (headers, value = body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(value) });
  assert.equal((await post({})).status, 401);
  const auth = { Authorization: 'Bearer fixture-gateway' };
  assert.equal((await post({ ...auth, Origin: 'https://example.com' })).status, 400);
  assert.equal((await (await post(auth, { ...body, budget: 100 })).json()).status, 'invalid_query'); assert.equal(calls, 0);
  assert.equal((await (await post(auth)).json()).status, 'searched'); assert.equal(calls, 1);
  assert.equal(openAiSearchKey({ OPENCLAW_MODEL_API_KEY: 'secret' }, { models: { providers: { 'lab-provider': { baseUrl: 'https://other.example', apiKey: { source: 'env', id: 'OPENCLAW_MODEL_API_KEY' } } } } }), '');
});

test('OpenClaw queries are restricted to the actual official docs and reject lookalike citations', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'companion-search-sources-'));
  const service = createSearchService({ directory, key: 'fixture', now: () => Date.parse('2026-09-21'), fetchImpl: async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.deepEqual(request.tools, [{ type: 'web_search', search_context_size: 'low' }]);
    assert.equal(request.input, 'site:docs.openclaw.ai OpenClaw documentation');
    const data = await response().json();
    data.output[1].content[0].annotations = [
      { type: 'url_citation', title: 'Official OpenClaw', url: 'https://unrelated.example/docs' },
      { type: 'url_citation', title: 'OpenClaw Docs', url: 'https://docs.openclaw.ai/' },
    ];
    return Response.json(data);
  } });
  t.after(async () => { service.close(); await rm(directory, { recursive: true, force: true }); });
  const result = await service.search({ id: id(15), query: 'OpenClaw documentation' });
  assert.equal(result.status, 'searched'); assert.deepEqual(result.results.map(r => r.url), ['https://docs.openclaw.ai/']);
});
