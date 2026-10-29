import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESENTATION_CAPABILITY_VERSION_HEADER, PRESENTATION_CAPABILITY_DEFAULT_VERSION,
  negotiatePresentationCapabilityVersion, presentationCapabilitiesForVersion, validatePresentationCapabilities,
} from '../packages/presentation/capability-contract.mjs';

const parsed = version => JSON.parse(JSON.stringify(presentationCapabilitiesForVersion(version)));
const versions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33];
const invalid = error => error.code === 'presentation_capability_invalid' && error.statusCode === 503;
const unsupported = error => error.code === 'presentation_capability_version_unsupported' && error.statusCode === 406;

test('v30 explicitly adds embedded MP4 AV without changing v29 or the default', () => {
  assert.equal(negotiatePresentationCapabilityVersion('30'),30);
  const cap=presentationCapabilitiesForVersion(30);
  assert.deepEqual(cap,{...presentationCapabilitiesForVersion(29),schemaVersion:30,recordedEmbeddedAv:'embedded-mp4-av-v2'});
  assert.equal(validatePresentationCapabilities(parsed(30),{expectedVersion:30}),cap);
  assert.equal(Object.hasOwn(presentationCapabilitiesForVersion(29),'recordedEmbeddedAv'),false);
  assert.equal(negotiatePresentationCapabilityVersion(undefined),2);
  assert.throws(()=>validatePresentationCapabilities(parsed(29),{expectedVersion:30}),invalid);
  assert.throws(()=>validatePresentationCapabilities({...parsed(30),recordedEmbeddedAv:'unverified'}),invalid);
  for(const malformed of ['34','030','30, 30','30, 29'])assert.throws(()=>negotiatePresentationCapabilityVersion(malformed),unsupported);
});

test('v31 explicitly adds frozen native film planning without changing v30 or the default', () => {
  assert.equal(negotiatePresentationCapabilityVersion('31'),31);
  const cap=presentationCapabilitiesForVersion(31);
  assert.deepEqual(cap,{...presentationCapabilitiesForVersion(30),schemaVersion:31,nativeFilmedPlanning:'frozen-topology-v2'});
  assert.equal(validatePresentationCapabilities(parsed(31),{expectedVersion:31}),cap);
  for(const version of [2,30])assert.equal(Object.hasOwn(presentationCapabilitiesForVersion(version),'nativeFilmedPlanning'),false);
  assert.equal(negotiatePresentationCapabilityVersion(undefined),2);
  assert.throws(()=>validatePresentationCapabilities(parsed(30),{expectedVersion:31}),invalid);
  assert.throws(()=>validatePresentationCapabilities({...parsed(30),nativeFilmedPlanning:'frozen-topology-v2'}),invalid);
  assert.throws(()=>validatePresentationCapabilities({...parsed(31),nativeFilmedPlanning:'unverified'}),invalid);
  for(const malformed of ['34','031','31.0',' 31','31 ','31, 31','31, 30',31,new String('31')])assert.throws(()=>negotiatePresentationCapabilityVersion(malformed),unsupported);
});

test('v32 explicitly adds proposed rest clips in a rotation without changing v31 or the default', () => {
  assert.equal(negotiatePresentationCapabilityVersion('32'),32);
  const cap=presentationCapabilitiesForVersion(32);
  assert.deepEqual(cap,{...presentationCapabilitiesForVersion(31),schemaVersion:32,idleRotationOffers:'rest-proposals-v1'});
  assert.equal(validatePresentationCapabilities(parsed(32),{expectedVersion:32}),cap);
  for(const version of [2,28,31])assert.equal(Object.hasOwn(presentationCapabilitiesForVersion(version),'idleRotationOffers'),false);
  assert.equal(negotiatePresentationCapabilityVersion(undefined),2);
  assert.throws(()=>validatePresentationCapabilities(parsed(31),{expectedVersion:32}),invalid);
  assert.throws(()=>validatePresentationCapabilities({...parsed(31),idleRotationOffers:'rest-proposals-v1'}),invalid);
  for(const malformed of ['34','032','32.0','32, 32','32, 31',32])assert.throws(()=>negotiatePresentationCapabilityVersion(malformed),unsupported);
});

test('v33 explicitly adds the lane miljöbild without changing v32 or the default', () => {
  assert.equal(negotiatePresentationCapabilityVersion('33'),33);
  const cap=presentationCapabilitiesForVersion(33);
  assert.deepEqual(cap,{...presentationCapabilitiesForVersion(32),schemaVersion:33,laneIllustration:'environment-image-v1'});
  assert.equal(validatePresentationCapabilities(parsed(33),{expectedVersion:33}),cap);
  for(const version of [2,31,32])assert.equal(Object.hasOwn(presentationCapabilitiesForVersion(version),'laneIllustration'),false);
  assert.equal(negotiatePresentationCapabilityVersion(undefined),2);
  assert.throws(()=>validatePresentationCapabilities(parsed(32),{expectedVersion:33}),invalid);
  assert.throws(()=>validatePresentationCapabilities({...parsed(32),laneIllustration:'environment-image-v1'}),invalid);
  assert.throws(()=>validatePresentationCapabilities({...parsed(33),laneIllustration:'unverified'}),invalid);
  for(const malformed of ['34','033','33.0',' 33','33 ','33, 33','33, 32',33,new String('33')])assert.throws(()=>negotiatePresentationCapabilityVersion(malformed),unsupported);
});

test('negotiation preserves default v2 and opts into v3-v33 only with one exact supported header', () => {
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
  assert.equal(negotiatePresentationCapabilityVersion('14'), 14);
  assert.equal(negotiatePresentationCapabilityVersion('15'), 15);
  assert.equal(negotiatePresentationCapabilityVersion('16'), 16);
  assert.equal(negotiatePresentationCapabilityVersion('17'), 17);
  assert.equal(negotiatePresentationCapabilityVersion('18'), 18);
  assert.equal(negotiatePresentationCapabilityVersion('19'), 19);
  assert.equal(negotiatePresentationCapabilityVersion('20'), 20);
  assert.equal(negotiatePresentationCapabilityVersion('21'), 21);
  assert.equal(negotiatePresentationCapabilityVersion('22'), 22);
  assert.equal(negotiatePresentationCapabilityVersion('23'), 23);
  assert.equal(negotiatePresentationCapabilityVersion('24'), 24);
  assert.equal(negotiatePresentationCapabilityVersion('25'), 25);
  assert.equal(negotiatePresentationCapabilityVersion('26'), 26);
  assert.equal(negotiatePresentationCapabilityVersion('27'), 27);
  assert.equal(negotiatePresentationCapabilityVersion('28'), 28);
  assert.equal(negotiatePresentationCapabilityVersion('29'), 29);
  assert.equal(negotiatePresentationCapabilityVersion('30'), 30);
  assert.equal(negotiatePresentationCapabilityVersion('31'), 31);
  assert.equal(negotiatePresentationCapabilityVersion('32'), 32);
  assert.equal(negotiatePresentationCapabilityVersion('33'), 33);
  for (const malformed of ['', '1', '34', '033', '33, 33', '032', '32, 32', '031', '31, 31', '31, 30', '030', '30, 30', '029', '29, 29', '28, 28', '028', '27, 27', '027', '026', '26, 26', '025', '25, 25', '024', '24, 24', '023', '23, 23', '022', '22, 22', '021', '21, 21', '020', '20, 20', '019', '19, 19', '018', '18, 18', '017', '17, 17', '016', '16, 16', '015', '15, 15', '014', '14, 14', '013', '13, 13', '012', '12, 12', '011', '11, 11', '010', '10, 10', '09', '9, 9', '08', '8, 8', '07', '7, 7', '06', '6, 6', '05', '5, 5', '4, 5', '04', '4, 4', '3, 4', '03', '3.0', ' 3', '3 ', '3, 3', '2, 3', 3, [], {}, new String('3')]) {
    assert.throws(() => negotiatePresentationCapabilityVersion(malformed), unsupported);
  }
});

test('v1-v33 exact representations advertise features while the legacy ID list never becomes registry authority', () => {
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
  assert.deepEqual(presentationCapabilitiesForVersion(14), {...presentationCapabilitiesForVersion(13),schemaVersion:14,dealerCategoryTrash:'retained-categories-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(15), {...presentationCapabilitiesForVersion(14),schemaVersion:15,rouletteIdle:'explicit-game-idle-v1',rouletteStart:'explicit-game-start-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(16), {...presentationCapabilitiesForVersion(15),schemaVersion:16,blackjackTableGeometry:'asset-static-anchors-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(17), {...presentationCapabilitiesForVersion(16),schemaVersion:17,recordedSpeech:'exact-take-review-v1',filmedDealVariants:'sixteen-explicit-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(18), {...presentationCapabilitiesForVersion(17),schemaVersion:18,presentationCompression:'gzip-brotli-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(19), {...presentationCapabilitiesForVersion(18),schemaVersion:19,blackjackBetMode:'under-cards-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(20), {...presentationCapabilitiesForVersion(19),schemaVersion:20,speechSlots:'explicit-line-standard-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(21), {...presentationCapabilitiesForVersion(20),schemaVersion:21,blackjackAnchors:'v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(22), {...presentationCapabilitiesForVersion(21),schemaVersion:22,clipPoses:'vila-redo-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(23), {...presentationCapabilitiesForVersion(22),schemaVersion:23,roomGameConfigs:'administration-drafts-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(24), {...presentationCapabilitiesForVersion(23),schemaVersion:24,layerPlayback:'table-and-jitter-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(25), {...presentationCapabilitiesForVersion(24),schemaVersion:25,blackjackAutoScale:'dealer-source-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(8), {...presentationCapabilitiesForVersion(7),schemaVersion:8,backgroundPlayback:'rules-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(28), {...presentationCapabilitiesForVersion(27),schemaVersion:28,idleRotation:'pose-graph-v1'});
  assert.deepEqual(presentationCapabilitiesForVersion(29),{...presentationCapabilitiesForVersion(28),schemaVersion:29,mediaTiming:'byte-bound-timeline-v1',extendedPresentation:'bounded-envelope-v2'});
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
  for (const version of [undefined, null, 0, 34, '4', '3', 3.1, {}, []]) assert.throws(() => presentationCapabilitiesForVersion(version), invalid);
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
    if(version>=33)assert.throws(()=>validatePresentationCapabilities({...input,laneIllustration:'unverified'}),invalid);
    if(version>=32)assert.throws(()=>validatePresentationCapabilities({...input,idleRotationOffers:'any-clip'}),invalid);
    if(version>=31)assert.throws(()=>validatePresentationCapabilities({...input,nativeFilmedPlanning:'unverified'}),invalid);
    if(version>=30)assert.throws(()=>validatePresentationCapabilities({...input,recordedEmbeddedAv:'unverified'}),invalid);
    if(version>=29){
      assert.throws(()=>validatePresentationCapabilities({...input,mediaTiming:'approximate'}),invalid);
      assert.throws(()=>validatePresentationCapabilities({...input,extendedPresentation:'unbounded'}),invalid);
    }
    if(version>=28)assert.throws(()=>validatePresentationCapabilities({...input,idleRotation:'unchecked'}),invalid);
    if(version>=17)assert.throws(()=>validatePresentationCapabilities({...input,recordedSpeech:'approximate-duration'}),invalid);
    if(version>=18)assert.throws(()=>validatePresentationCapabilities({...input,presentationCompression:'unbounded'}),invalid);
    if(version>=19)assert.throws(()=>validatePresentationCapabilities({...input,blackjackBetMode:'unbound'}),invalid);
    if(version>=17)assert.throws(()=>validatePresentationCapabilities({...input,filmedDealVariants:'unbounded'}),invalid);
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

