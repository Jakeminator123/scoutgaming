import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationCapabilitiesResponse } from '../services/game/presentation-capabilities.mjs';
import { validatePresentationCapabilities, presentationCapabilitiesForVersion } from '../packages/presentation/capability-contract.mjs';
const endpoint = 'https://engine.example.invalid/api/presentation/capabilities';

test('v31 negotiates frozen native film planning while older readers keep their exact contracts',async()=>{
  const headers={'X-Presentation-Capability-Version':'31'};
  const response=presentationCapabilitiesResponse(new Request(endpoint,{headers}));
  assert.equal(response.status,200);
  const text=await response.text();assert.ok(Buffer.byteLength(text)<=2048);
  const cap=validatePresentationCapabilities(JSON.parse(text),{expectedVersion:31});
  assert.equal(cap.nativeFilmedPlanning,'frozen-topology-v2');
  assert.equal(cap.recordedEmbeddedAv,'embedded-mp4-av-v2');
  assert.equal(response.headers.get('cache-control'),'no-store');
  const head=presentationCapabilitiesResponse(new Request(endpoint,{method:'HEAD',headers}));
  assert.equal(head.status,200);assert.equal(await head.text(),'');
  const previous=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'30'}})).json();
  assert.equal(Object.hasOwn(previous,'nativeFilmedPlanning'),false);
  assert.deepEqual(previous,JSON.parse(JSON.stringify(presentationCapabilitiesForVersion(30))));
  assert.throws(()=>validatePresentationCapabilities({...cap,nativeFilmedPlanning:'legacy'}, {expectedVersion:31}),{code:'presentation_capability_invalid'});
});

test('v30 serves exact embedded MP4 AV capability for GET and HEAD while v29 remains unchanged',async()=>{
  const headers={'X-Presentation-Capability-Version':'30'};
  const response=presentationCapabilitiesResponse(new Request(endpoint,{headers}));
  assert.equal(response.status,200);
  const body=await response.text();assert.ok(Buffer.byteLength(body)<=2048);
  const cap=validatePresentationCapabilities(JSON.parse(body),{expectedVersion:30});
  assert.equal(cap.recordedEmbeddedAv,'embedded-mp4-av-v2');
  assert.equal(cap.recordedSpeech,'exact-take-review-v1');
  assert.equal(cap.mediaTiming,'byte-bound-timeline-v1');
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('vary'),'X-Presentation-Capability-Version');
  const head=presentationCapabilitiesResponse(new Request(endpoint,{method:'HEAD',headers}));
  assert.equal(head.status,200);assert.equal(await head.text(),'');
  const old=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'29'}})).json();
  assert.equal(Object.hasOwn(old,'recordedEmbeddedAv'),false);
  assert.deepEqual(old,JSON.parse(JSON.stringify(presentationCapabilitiesForVersion(29))));
});

test('v12 announces strict PNG/VP9 alpha and roulette media while preserving v11 features',async()=>{
  const response=presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'12'}}));
  assert.equal(response.status,200);const cap=validatePresentationCapabilities(await response.json(),{expectedVersion:12});
  assert.equal(cap.mediaAlpha,'png-vp9-v1');assert.equal(cap.rouletteMedia,'action-pose-slots-v1');
  assert.equal(cap.dealerSets,'authoring-categories-v1');assert.equal(cap.materialTrash,'detached-assets-v1');
  const old=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'11'}})).json();
  assert.equal(Object.hasOwn(old,'mediaAlpha'),false);assert.equal(Object.hasOwn(old,'rouletteMedia'),false);
});

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
  for (const version of ['1', '34', '032', '32, 32', '031', '31, 31', '030', '30, 30', '29, 29', '029', '28, 28', '028', '27, 27', '027', '26, 26', '25, 25', '24, 24', '23, 23', '22, 22', '20, 20', '19, 19', '18, 18', '17, 17', '16, 16', '15, 15', '14, 14', '13, 13', '12, 12', '11, 11', '10, 10', '9, 9', '8, 8', '7, 7', '4, 4', '3, 4', '3, 3', '2, 3', '03']) {
    const response = presentationCapabilitiesResponse(new Request(endpoint, { headers: { 'X-Presentation-Capability-Version': version } }));
    assert.equal(response.status, 406); assert.equal(await response.text(), '');
  }
});

test('v24 advertises living table and jittered layer clips within the readiness response limit', async () => {
  const response=presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'24'}}));
  assert.equal(response.status,200);
  const body=await response.text();assert.ok(Buffer.byteLength(body)<=2048);
  const cap=validatePresentationCapabilities(JSON.parse(body),{expectedVersion:24});
  assert.equal(cap.layerPlayback,'table-and-jitter-v1');assert.equal(cap.roomGameConfigs,'administration-drafts-v1');
  const old=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'23'}})).json();
  assert.equal(Object.hasOwn(old,'layerPlayback'),false);
});

test('v23 advertises administration room drafts within the readiness response limit', async () => {
  const response=presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'23'}}));
  assert.equal(response.status,200);
  const body=await response.text();assert.ok(Buffer.byteLength(body)<=2048);
  const cap=validatePresentationCapabilities(JSON.parse(body),{expectedVersion:23});
  assert.equal(cap.roomGameConfigs,'administration-drafts-v1');assert.equal(cap.clipPoses,'vila-redo-v1');
  const old=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'22'}})).json();
  assert.equal(Object.hasOwn(old,'roomGameConfigs'),false);
});

test('v22 advertises declared clip pose chains within the readiness response limit', async () => {
  const headers={'X-Presentation-Capability-Version':'22'};
  const response=presentationCapabilitiesResponse(new Request(endpoint,{headers}));
  assert.equal(response.status,200);
  // v22 crosses the former 1024-byte reader bound; readiness now reads up to 2048.
  const body=await response.text();assert.ok(Buffer.byteLength(body)<=2048);
  const cap=validatePresentationCapabilities(JSON.parse(body),{expectedVersion:22});
  assert.equal(cap.clipPoses,'vila-redo-v1');assert.equal(cap.blackjackAnchors,'v1');
  const old=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'21'}})).json();
  assert.equal(Object.hasOwn(old,'clipPoses'),false);
});

test('v21 advertises independent anchors within the readiness response limit', async () => {
  const headers={'X-Presentation-Capability-Version':'21'};
  const response=presentationCapabilitiesResponse(new Request(endpoint,{headers}));
  assert.equal(response.status,200);
  const body=await response.text();assert.ok(Buffer.byteLength(body)<=1024);
  assert.equal(validatePresentationCapabilities(JSON.parse(body),{expectedVersion:21}).blackjackAnchors,'v1');
  const head=presentationCapabilitiesResponse(new Request(endpoint,{method:'HEAD',headers}));
  assert.equal(head.status,200);assert.equal(await head.text(),'');
  const old=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'20'}})).json();
  assert.equal(Object.hasOwn(old,'blackjackAnchors'),false);
});

test('v20 advertises exact speech slot standards within the same bounded response', async () => {
  const headers = { 'X-Presentation-Capability-Version': '20' };
  const response = presentationCapabilitiesResponse(new Request(endpoint, { headers }));
  assert.equal(response.status, 200);
  const body = await response.text(); assert.ok(Buffer.byteLength(body) <= 1024);
  assert.equal(validatePresentationCapabilities(JSON.parse(body), { expectedVersion: 20 }).speechSlots, 'explicit-line-standard-v1');
  const old = await presentationCapabilitiesResponse(new Request(endpoint, { headers: { 'X-Presentation-Capability-Version': '19' } })).json();
  assert.equal(Object.hasOwn(old, 'speechSlots'), false);
});

test('v19 advertises dynamic table bets within the bounded payload without changing v18',async()=>{
  const headers={'X-Presentation-Capability-Version':'19'},response=presentationCapabilitiesResponse(new Request(endpoint,{headers}));
  assert.equal(response.status,200);const body=await response.text();assert.ok(Buffer.byteLength(body)<=1024);
  assert.equal(validatePresentationCapabilities(JSON.parse(body),{expectedVersion:19}).blackjackBetMode,'under-cards-v1');
  const head=presentationCapabilitiesResponse(new Request(endpoint,{method:'HEAD',headers}));assert.equal(head.status,200);assert.equal(await head.text(),'');
  const old=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'18'}})).json();
  assert.equal(Object.hasOwn(old,'blackjackBetMode'),false);
});

test('v18 explicitly advertises bounded gzip and Brotli without changing v17',async()=>{
  const headers={'X-Presentation-Capability-Version':'18'},response=presentationCapabilitiesResponse(new Request(endpoint,{headers}));
  assert.equal(response.status,200);const body=await response.text();assert.ok(Buffer.byteLength(body)<=1024);
  assert.equal(validatePresentationCapabilities(JSON.parse(body),{expectedVersion:18}).presentationCompression,'gzip-brotli-v1');
  const head=presentationCapabilitiesResponse(new Request(endpoint,{method:'HEAD',headers}));assert.equal(head.status,200);assert.equal(await head.text(),'');
  const old=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'17'}})).json();
  assert.equal(Object.hasOwn(old,'presentationCompression'),false);
});

test('v17 announces exact recorded speech while older negotiation and the response bound stay unchanged',async()=>{
  const headers={'X-Presentation-Capability-Version':'17'},response=presentationCapabilitiesResponse(new Request(endpoint,{headers}));
  assert.equal(response.status,200);const body=await response.text();assert.ok(Buffer.byteLength(body)<=1024);
  assert.equal(validatePresentationCapabilities(JSON.parse(body),{expectedVersion:17}).recordedSpeech,'exact-take-review-v1');
  assert.equal(validatePresentationCapabilities(JSON.parse(body),{expectedVersion:17}).filmedDealVariants,'sixteen-explicit-v1');
  const head=presentationCapabilitiesResponse(new Request(endpoint,{method:'HEAD',headers}));assert.equal(head.status,200);assert.equal(await head.text(),'');
  const old=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'16'}})).json();
  assert.equal(Object.hasOwn(old,'recordedSpeech'),false);
  assert.equal(Object.hasOwn(old,'filmedDealVariants'),false);
});

test('v16 explicitly negotiates static per-asset blackjack geometry within the bounded readiness payload',async()=>{
  const response=presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'16'}}));
  assert.equal(response.status,200);const body=await response.text();assert.ok(Buffer.byteLength(body)<=1024);
  assert.equal(validatePresentationCapabilities(JSON.parse(body),{expectedVersion:16}).blackjackTableGeometry,'asset-static-anchors-v1');
  const old=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'15'}})).json();
  assert.equal(Object.hasOwn(old,'blackjackTableGeometry'),false);
});

test('v15 combines roulette with retained categories while v14 advertises only the shipped category addition',async()=>{
  const response=presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'15'}}));
  assert.equal(response.status,200);const value=validatePresentationCapabilities(await response.json(),{expectedVersion:15});
  assert.equal(value.rouletteStart,'explicit-game-start-v1');assert.equal(value.rouletteIdle,'explicit-game-idle-v1');
  assert.equal(value.dealerCategoryTrash,'retained-categories-v1');
  const previous=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'14'}})).json();
  assert.equal(previous.dealerCategoryTrash,'retained-categories-v1');
  assert.equal(Object.hasOwn(previous,'rouletteIdle'),false);
  assert.equal(Object.hasOwn(previous,'rouletteStart'),false);
});

test('v14 advertises retained dealer categories without changing v13',async()=>{
  const response=presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'14'}}));
  assert.equal(response.status,200);
  const value=validatePresentationCapabilities(await response.json(),{expectedVersion:14});
  assert.equal(value.dealerCategoryTrash,'retained-categories-v1');
  const previous=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'13'}})).json();
  assert.equal(Object.hasOwn(previous,'dealerCategoryTrash'),false);
});

test('v13 advertises immutable game-specific tables without changing v12',async()=>{
  const response=presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'13'}}));
  const value=validatePresentationCapabilities(await response.json(),{expectedVersion:13});
  assert.equal(value.tableGame,'immutable-game-v1');assert.equal(value.rouletteMedia,'action-pose-slots-v1');
  const previous=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'12'}})).json();
  assert.equal(Object.hasOwn(previous,'tableGame'),false);
});

test('v10 authoring categories negotiate without adding fields to older capability responses', async () => {
  const response = presentationCapabilitiesResponse(new Request(endpoint, { headers: { 'X-Presentation-Capability-Version': '10' } }));
  assert.equal(response.status, 200);
  const cap = validatePresentationCapabilities(await response.json(), { expectedVersion: 10 });
  assert.equal(cap.dealerSets, 'authoring-categories-v1');
  for (const version of [undefined, '9']) {
    const prior = await presentationCapabilitiesResponse(new Request(endpoint, { headers: version ? { 'X-Presentation-Capability-Version': version } : {} })).json();
    assert.equal(Object.hasOwn(prior, 'dealerSets'), false);
  }
});

test('v11 HTTP and HEAD advertise both implemented authoring sets and material trash without changing v10',async()=>{
  const headers={'X-Presentation-Capability-Version':'11'};
  const response=presentationCapabilitiesResponse(new Request(endpoint,{headers}));
  assert.equal(response.status,200);
  const value=validatePresentationCapabilities(await response.json(),{expectedVersion:11});
  assert.equal(value.dealerSets,'authoring-categories-v1');
  assert.equal(value.materialTrash,'detached-assets-v1');
  const head=presentationCapabilitiesResponse(new Request(endpoint,{method:'HEAD',headers}));
  assert.equal(head.status,200);assert.equal(await head.text(),'');
  const older=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'10'}})).json();
  assert.equal(older.dealerSets,'authoring-categories-v1');assert.equal(Object.hasOwn(older,'materialTrash'),false);
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

test('v5 explicitly advertises dealer lifecycle while the default remains v2',async()=>{
 const response=presentationCapabilitiesResponse(new Request('https://example.invalid/api/presentation/capabilities',{headers:{'X-Presentation-Capability-Version':'5'}}));
 assert.equal(response.status,200);assert.equal((await response.json()).dealerLifecycle,'trash-v1');
});

test('v6 explicitly advertises resource lifecycle without changing default or v5 responses',async()=>{
 const response=presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'6'}}));
 assert.equal(response.status,200);
 const capability=validatePresentationCapabilities(await response.json(),{expectedVersion:6});
 assert.equal(capability.resourceLifecycle,'operator-room-archive-v1');
 for(const version of [undefined,'5']){
  const prior=await presentationCapabilitiesResponse(new Request(endpoint,{headers:version?{'X-Presentation-Capability-Version':version}:{}})).json();
  assert.equal(prior.schemaVersion,version?5:2);assert.equal(Object.hasOwn(prior,'resourceLifecycle'),false);
 }
});
test('v7 advertises complete dealer archive cascade without widening older contracts',async()=>{
 const response=presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'7'}}));
 const cap=validatePresentationCapabilities(await response.json(),{expectedVersion:7});assert.equal(cap.dealerArchiveCascade,'dealer-compositions-rooms-v1');
 for(const version of ['5','6']){const old=await presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':version}})).json();assert.equal(Object.hasOwn(old,'dealerArchiveCascade'),false);}
});
test('v8 advertises background playback only when explicitly negotiated',async()=>{
 const response=presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'8'}}));
 assert.equal(response.status,200);
 const cap=validatePresentationCapabilities(await response.json(),{expectedVersion:8});assert.equal(cap.backgroundPlayback,'rules-v1');
 for(const version of [undefined,'7']){
  const old=await presentationCapabilitiesResponse(new Request(endpoint,{headers:version?{'X-Presentation-Capability-Version':version}:{}})).json();
  assert.equal(Object.hasOwn(old,'backgroundPlayback'),false);
 }
 assert.throws(()=>validatePresentationCapabilities({...cap,backgroundPlayback:'unbounded'}, {expectedVersion:8}));
});
test('v9 advertises roulette while preserving every earlier capability representation', async () => {
  const response = presentationCapabilitiesResponse(new Request(endpoint, {headers: {'X-Presentation-Capability-Version': '9'}}));
  assert.equal(response.status, 200);
  const cap = validatePresentationCapabilities(await response.json(), {expectedVersion: 9});
  assert.equal(cap.rouletteRooms, 'european-single-zero-v1');
  for (const version of [undefined, '2', '3', '4', '5', '6', '7', '8']) {
    const old = await presentationCapabilitiesResponse(new Request(endpoint, {headers: version ? {'X-Presentation-Capability-Version': version} : {}})).json();
    assert.equal(Object.hasOwn(old, 'rouletteRooms'), false);
  }
});

test('v25 announces dealer-source blackjack autoScale and keeps the v24 layer playback; v24 does not announce it',async()=>{
  const read=async version=>{const response=presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':String(version)}}));
    assert.equal(response.status,200);return validatePresentationCapabilities(await response.json(),{expectedVersion:version});};
  const cap=await read(25),old=await read(24);
  assert.equal(cap.blackjackAutoScale,'dealer-source-v1');assert.equal(cap.layerPlayback,'table-and-jitter-v1');assert.equal(cap.blackjackAnchors,'v1');
  assert.equal(Object.hasOwn(old,'blackjackAutoScale'),false);
});

test('v26 advertises saved card display without changing v25',async()=>{
 const response=presentationCapabilitiesResponse(new Request(endpoint,{headers:{'X-Presentation-Capability-Version':'26'}}));
 assert.equal(response.status,200);const text=await response.text();assert.ok(Buffer.byteLength(text)<=2048);
 const value=validatePresentationCapabilities(JSON.parse(text),{expectedVersion:26});
 assert.equal(value.blackjackCardView,'saved-layout-v1');assert.equal(value.blackjackAutoScale,'dealer-source-v1');
 assert.equal(Object.hasOwn(presentationCapabilitiesForVersion(25),'blackjackCardView'),false);
});

test('v28 advertises idle pose-graph rotation without changing earlier endpoint responses',async()=>{
  const headers={'X-Presentation-Capability-Version':'28'};
  const response=presentationCapabilitiesResponse(new Request(endpoint,{headers}));
  assert.equal(response.status,200);
  const body=await response.text();assert.ok(Buffer.byteLength(body)<=2048);
  const value=validatePresentationCapabilities(JSON.parse(body),{expectedVersion:28});
  assert.equal(value.idleRotation,'pose-graph-v1');
  assert.equal(value.blackjackGameUi,'responsive-controls-v1');
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('vary'),'X-Presentation-Capability-Version');
  const head=presentationCapabilitiesResponse(new Request(endpoint,{method:'HEAD',headers}));
  assert.equal(head.status,200);assert.equal(await head.text(),'');
  for(const version of [undefined,...Array.from({length:26},(_,i)=>String(i+2))]){
    const earlier=presentationCapabilitiesResponse(new Request(endpoint,{headers:version?{'X-Presentation-Capability-Version':version}:{}}));
    assert.equal(earlier.status,200);
    const prior=await earlier.json();
    assert.equal(Object.hasOwn(prior,'idleRotation'),false);
    assert.deepEqual(prior,JSON.parse(JSON.stringify(presentationCapabilitiesForVersion(version?Number(version):2))));
  }
});

