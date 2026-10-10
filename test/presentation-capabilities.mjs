import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationCapabilitiesResponse } from '../web/presentation-capabilities.mjs';
import { validatePresentationCapabilities } from '../web/presentation-capability-contract.mjs';
const endpoint = 'https://engine.example.invalid/api/presentation/capabilities';

test('default feature HTTP response remains exact v2 and negotiation returns exact v3 without credentials or reads', async () => {
  const legacy = presentationCapabilitiesResponse(new Request(endpoint));
  assert.equal(legacy.status, 200); assert.equal(validatePresentationCapabilities(await legacy.json(), { expectedVersion: 2 }).schemaVersion, 2);
  const modern = presentationCapabilitiesResponse(new Request(endpoint, { headers: { 'X-Presentation-Capability-Version': '3', cookie: 'irrelevant-fixture' } }));
  assert.equal(modern.status, 200); const cap = validatePresentationCapabilities(await modern.json(), { expectedVersion: 3 });
  assert.equal(cap.registeredDealerMode, 'saved-registry-idle-v1'); assert.equal(cap.frozenDealerIdle, 'operator-package-v2');
  assert.equal(modern.headers.get('cache-control'), 'no-store'); assert.equal(modern.headers.get('vary'), 'X-Presentation-Capability-Version');
});

test('HEAD negotiates the same metadata response with no body and unsupported or duplicate versions are 406', async () => {
  const head = presentationCapabilitiesResponse(new Request(endpoint, { method: 'HEAD', headers: { 'X-Presentation-Capability-Version': '3' } }));
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  for (const version of ['1', '5', '4, 4', '3, 4', '3, 3', '2, 3', '03']) {
    const response = presentationCapabilitiesResponse(new Request(endpoint, { headers: { 'X-Presentation-Capability-Version': version } }));
    assert.equal(response.status, 406); assert.equal(await response.text(), '');
  }
});

test('negotiation never widens capability endpoint path, query or method handling', () => {
  assert.equal(presentationCapabilitiesResponse(new Request(endpoint + '/other')), null);
  assert.equal(presentationCapabilitiesResponse(new Request(endpoint + '?version=3')).status, 400);
  const post = presentationCapabilitiesResponse(new Request(endpoint, { method: 'POST' }));
  assert.equal(post.status, 405); assert.equal(post.headers.get('allow'), 'GET, HEAD');
});

test('v4 negotiates frozen event clips while default/v3 responses retain their exact earlier representations', async () => {
  const response = presentationCapabilitiesResponse(new Request(endpoint, { headers: { 'X-Presentation-Capability-Version': '4' } }));
  assert.equal(response.status, 200);
  const cap = validatePresentationCapabilities(await response.json(), { expectedVersion: 4 });
  assert.equal(cap.frozenDealerEvents, 'operator-package-v3');
  assert.equal(cap.frozenDealerIdle, 'operator-package-v2');
  assert.equal(response.headers.get('vary'), 'X-Presentation-Capability-Version');
  const head = presentationCapabilitiesResponse(new Request(endpoint, { method:'HEAD', headers: { 'X-Presentation-Capability-Version': '4' } }));
  assert.equal(head.status,200); assert.equal(await head.text(),'');
  for(const version of [undefined,'3']) {
    const older = await presentationCapabilitiesResponse(new Request(endpoint, {headers:version ? {'X-Presentation-Capability-Version':version} : {}})).json();
    assert.equal(older.schemaVersion, version ? 3 : 2);
    assert.equal(Object.hasOwn(older,'frozenDealerEvents'),false);
  }
});
