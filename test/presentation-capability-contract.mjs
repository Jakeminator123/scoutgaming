import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESENTATION_CAPABILITY_VERSION_HEADER, PRESENTATION_CAPABILITY_DEFAULT_VERSION,
  negotiatePresentationCapabilityVersion, presentationCapabilitiesForVersion, validatePresentationCapabilities,
} from '../web/presentation-capability-contract.mjs';

const parsed = version => JSON.parse(JSON.stringify(presentationCapabilitiesForVersion(version)));
const versions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const invalid = error => error.code === 'presentation_capability_invalid' && error.statusCode === 503;
const unsupported = error => error.code === 'presentation_capability_version_unsupported' && error.statusCode === 406;

test('negotiation preserves default v2 and opts into v3-v11 only with one exact supported header', () => {
  assert.equal(PRESENTATION_CAPABILITY_VERSION_HEADER, 'X-Presentation-Capability-Version');
  assert.equal(PRESENTATION_CAPABILITY_DEFAULT_VERSION, 2);
  for (const absent of [undefined, null]) assert.equal(negotiatePresentationCapabilityVersion(absent), 2);
  assert.equal(negotiatePresentationCapabilityVersion('2'), 2);
  assert.equal(negotiatePresentationCapabilityVersion('3'), 3);
  assert.equal(negotiatePresentationCapabilityVersion('4'), 4);
  assert.equal(negotiatePresentationCapabilityVersion('5'), 5);
  assert.equal(negotiatePresentationCapabilityVersion('6'), 6);
  assert.equal(negotiatePresentationCapabilityVersion('7'), 7);
  assert.equal(negotiatePresentationCapabilityVersion('8'), 8);
  assert.equal(negotiatePresentationCapabilityVersion('9'), 9);
  assert.equal(negotiatePresentationCapabilityVersion('10'), 10);
  assert.equal(negotiatePresentationCapabilityVersion('11'), 11);
  assert.equal(negotiatePresentationCapabilityVersion('12'), 12);
  assert.equal(negotiatePresentationCapabilityVersion('13'), 13);
  for (const malformed of ['', '1', '14', '013', '13, 13', '012', '12, 12', '011', '11, 11', '010', '10, 10', '09', '9, 9', '08', '8, 8', '07', '7, 7', '06', '6, 6', '05', '5, 5', '4, 5', '04', '4, 4', '3, 4', '03', '3.0', ' 3', '3 ', '3, 3', '2, 3', 3, [], {}, new String('3')]) {
    assert.throws(() => negotiatePresentationCapabilityVersion(malformed), unsupported);
  }
});

test('v1-v11 exact representations advertise features while the legacy ID list never becomes registry authority', () => {
  const shared = { registeredDealerIds: ['nora'], compositing: 'per-clip' };
  assert.deepEqual(presentationCapabilitiesForVersion(1), { schemaVersion: 1, ...shared });
  assert.deepEqual(presentationCapabilitiesForVersion(2), { schemaVersion: 2, ...shared, rooms: 'operator-owned-v2' });
  assert.deepEqual(presentationCapabilitiesForVersion(3), { schemaVersion: 3, ...shared, rooms: 'operator-owned-v2',
    registeredDealerMode: 'saved-registry-idle-v1', frozenDealerIdle: 'operator-package-v2' });
  assert.deepEqual(presentationCapabilitiesForVersion(4), { schemaVersion: 4, ...shared, rooms: 'operator-owned-v2',
    registeredDealerMode: 'saved-registry-idle-v1', frozenDealerIdle: 'operator-package-v2', frozenDealerEvents: 'operator-package-v3' });
  assert.deepEqual(presentationCapabilitiesForVersion(5), {...presentationCapabilitiesForVersion(4),schemaVersion:5,dealerLifecycle:'trash-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(6), {...presentationCapabilitiesForVersion(5),schemaVersion:6,resourceLifecycle:'operator-room-archive-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(9), {...presentationCapabilitiesForVersion(8),schemaVersion:9,rouletteRooms:'european-single-zero-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(10), {...presentationCapabilitiesForVersion(9),schemaVersion:10,dealerSets:'authoring-categories-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(11), {...presentationCapabilitiesForVersion(10),schemaVersion:11,materialTrash:'detached-assets-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(12), {...presentationCapabilitiesForVersion(11),schemaVersion:12,mediaAlpha:'png-vp9-v1',rouletteMedia:'action-pose-slots-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(13), {...presentationCapabilitiesForVersion(12),schemaVersion:13,tableGame:'immutable-game-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(8), {...presentationCapabilitiesForVersion(7),schemaVersion:8,backgroundPlayback:'rules-v1'});
  for (const version of versions) {
    const input = parsed(version), checked = validatePresentationCapabilities(input);
    assert.deepEqual(checked, input); assert.ok(Object.isFrozen(checked)); assert.ok(Object.isFrozen(checked.registeredDealerIds));
    input.registeredDealerIds[0] = 'johanna'; input.compositing = 'anything';
    assert.equal(checked.registeredDealerIds[0], 'nora'); assert.equal(checked.compositing, 'per-clip');
    assert.throws(() => checked.registeredDealerIds.push('johanna'), TypeError);
  }
});

test('expected-version validation rejects downgrade even when the old response is otherwise valid', () => {
  for (const version of versions) {
    assert.equal(validatePresentationCapabilities(parsed(version), { expectedVersion: version }).schemaVersion, version);
    for (const expected of versions.filter(expected => expected !== version)) {
      assert.throws(() => validatePresentationCapabilities(parsed(version), { expectedVersion: expected }), invalid);
    }
  }
  for (const version of [undefined, null, 0, 14, '4', '3', 3.1, {}, []]) assert.throws(() => presentationCapabilitiesForVersion(version), invalid);
  assert.throws(() => validatePresentationCapabilities(parsed(3), { expectedVersion: '3' }), invalid);
});

test('each schema rejects missing/extra properties and altered feature values', () => {
  for (const version of versions) {
    const input = parsed(version);
    for (const key of Object.keys(input)) { const missing = { ...input }; delete missing[key]; assert.throws(() => validatePresentationCapabilities(missing), invalid); }
    for (const [key, value] of [['extra', true], ['schemaVersion', String(version)], ['compositing', 'layered'], ['registeredDealerIds', []],
      ['registeredDealerIds', ['nora', 'johanna']], ['registeredDealerIds', ['johanna']], ['registeredDealerIds', ['Nora']], ['registeredDealerIds', null]]) {
      assert.throws(() => validatePresentationCapabilities({ ...input, [key]: value }), invalid);
    }
    if (version >= 2) assert.throws(() => validatePresentationCapabilities({ ...input, rooms: 'any-room' }), invalid);
    if (version >= 4) assert.throws(() => validatePresentationCapabilities({ ...input, frozenDealerEvents: 'latest-draft' }), invalid);
    if (version >= 5) assert.throws(() => validatePresentationCapabilities({...input,dealerLifecycle:'unchecked-purge'}),invalid);
    if(version>=7)assert.throws(()=>validatePresentationCapabilities({...input,dealerArchiveCascade:'unchecked'}),invalid);
    if(version>=9)assert.throws(()=>validatePresentationCapabilities({...input,rouletteRooms:'double-zero'}),invalid);
    if(version>=10)assert.throws(()=>validatePresentationCapabilities({...input,dealerSets:'frozen-package-versions'}),invalid);
    if(version>=11)assert.throws(()=>validatePresentationCapabilities({...input,materialTrash:'hidden-active-links'}),invalid);
    if(version>=12){assert.throws(()=>validatePresentationCapabilities({...input,mediaAlpha:'unverified'}),invalid);assert.throws(()=>validatePresentationCapabilities({...input,rouletteMedia:'blackjack-slots'}),invalid);}
    if(version>=8)assert.throws(()=>validatePresentationCapabilities({...input,backgroundPlayback:'unbounded'}),invalid);
    if (version >= 3) {
      assert.throws(() => validatePresentationCapabilities({ ...input, registeredDealerMode: 'caller-registry' }), invalid);
      assert.throws(() => validatePresentationCapabilities({ ...input, frozenDealerIdle: 'latest-draft' }), invalid);
    }
  }
});

test('untrusted prototypes, accessors, hidden or symbol properties cannot widen the portable payload', () => {
  for (const value of [undefined, null, [], true, 3, '3', Object.create(parsed(3))]) assert.throws(() => validatePresentationCapabilities(value), invalid);
  const nullPrototype = Object.assign(Object.create(null), parsed(3));
  assert.equal(validatePresentationCapabilities(nullPrototype).schemaVersion, 3);
  for (const property of ['hidden', Symbol('hidden')]) {
    const input = parsed(3); Object.defineProperty(input, property, { value: true });
    assert.throws(() => validatePresentationCapabilities(input), invalid);
  }
  const accessor = parsed(3); Object.defineProperty(accessor, 'schemaVersion', { get() { assert.fail('payload accessor executed'); }, enumerable: true });
  assert.throws(() => validatePresentationCapabilities(accessor), invalid);
  for (const decorate of [ids => Object.defineProperty(ids, 'hidden', { value: true }), ids => { ids[Symbol('hidden')] = true; },
    ids => Object.defineProperty(ids, '0', { get() { assert.fail('array accessor executed'); }, enumerable: true }), ids => Object.setPrototypeOf(ids, null)]) {
    const input = parsed(3); decorate(input.registeredDealerIds); assert.throws(() => validatePresentationCapabilities(input), invalid);
  }
});
