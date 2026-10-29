import test from 'node:test';
import assert from 'node:assert/strict';
import { addDealer, createEmptyProject, defaultPresentationLane, validateProject } from '../packages/presentation/contracts/studio-model.mjs';
import { createRegisteredIdlePolicy, registeredIdleInventory, registeredIdlePolicy } from '../packages/presentation/runtime/registered-idle-policy.mjs';
import { selectRegisteredIdleRule } from '../services/game/presentation-selection.mjs';
import { createLiveIdleController } from '../packages/presentation/runtime/live-idle.mjs';
import { captureFrozenPresentation } from '../packages/presentation/server/frozen-presentation-capture.mjs';
import { frozenPlaybackProject } from '../packages/presentation/contracts/frozen-dealer-playback.mjs';

const uuid = n => '20000000-0000-4000-8000-' + String(n).padStart(12, '0');
function fixture() {
  const project = addDealer(createEmptyProject(), 'linnea', 'Linnea');
  const line = project.lines.find(row => row.dealerId === 'linnea' && row.eventId === 'idle.ready');
  line.variants[0].videoGenerationId = uuid(1);
  const policy = createRegisteredIdlePolicy({ dealerId: 'linnea', baselineVideoId: uuid(1), durationMs: 1000 });
  policy.variants = [{ videoId: uuid(2), durationMs: 1000, use: 'rules', automatic: null }];
  project.dealerIdlePolicies = [{ dealerId: 'linnea', policy }];
  project.triggers.push({ id: 'idle.box3', label: 'Publicerad plats', category: 'deterministic', path: 'event.box', op: 'eq', value: 3 });
  line.variants.push({ ...structuredClone(line.variants[0]), id: 'linnea.idle.ready.rule1', label: 'Egen reaktion',
    priority: 50, triggerIds: ['idle.box3'], videoGenerationId: uuid(2), selection: { rules: true, random: false, model: false } });
  const records = [1, 2].map(n => ({ id: uuid(n), sha256: String(n).repeat(64), size: 1024, contentType: 'video/mp4',
    pathname: 'croupier/media/dealers/linnea/review/uploads/' + uuid(n) + '/' + String(n).repeat(64) + '.mp4',
    classification: { dealerId: 'linnea', eventId: 'idle.ready', kind: 'idle', role: n === 1 ? 'standard' : 'alternative',
      situation: '', label: 'Egen grundloop', notes: '', compositing: { mode: 'green-screen', threshold: .2, softness: .1, despill: 0 } } }));
  const inventory = { families: [], videos: records.map(row => ({ id: row.id, sha256: row.sha256, bytes: row.size,
    dealer: 'linnea', classification: row.classification, available: true, integrity: 'verified' })) };
  const sourceEvent = { ...structuredClone(project.events.find(row => row.id === 'deal.player.centre').exampleEvent), box: 3 };
  const select = (patch = {}) => selectRegisteredIdleRule({ project, dealerId: 'linnea', sourceEvent, mode: 'rules', ...patch }, { inventory });
  return { project, line, policy, records, inventory, sourceEvent, select };
}
function controllerFixture() {
  const f = fixture();
  let clock = 0;
  const controller = createLiveIdleController({ policy: f.policy, inventory: registeredIdleInventory(f.inventory, { dealerId: 'linnea', policy: f.policy }),
    dealerId: 'linnea', now: () => clock, initialScene: { active: true } });
  return { ...f, controller, at: value => { clock = value; },
    offer: (id = 'rule-1', expiresAt = clock + 10000, options = { use: 'rules' }) => controller.offerVariant({ videoId: uuid(2), requestId: id, expiresAt }, options),
    complete: () => { const clip = controller.snapshot().clip; controller.presented(clip.playId); clock += 1000; return controller.completed(clip.playId).clip; } };
}

test('saved explicit idle rule matches only the received public game event and leaves project untouched', () => {
  const f = fixture(), before = JSON.stringify(f.project);
  assert.deepEqual(f.select(), { videoId: uuid(2), variantId: 'linnea.idle.ready.rule1', reason: 'deterministic_rules' });
  assert.equal(f.select({ sourceEvent: { ...f.sourceEvent, box: 4 } }), null);
  assert.equal(JSON.stringify(f.project), before);
  for (const mode of ['off', 'random', 'active', 'shadow']) assert.equal(f.select({ mode }), null);
  for (const sourceEvent of [{ type: 'idle' }, { type: 'speak', line: 'goodluck' }]) assert.equal(f.select({ sourceEvent }), null);
  assert.equal(f.select({sourceEvent:{type:'turn',box:3,handIndex:0,legalActions:['stand']}}).videoId,uuid(2));
});

test('no explicit trigger, selection, policy role, baseline or compatible own media means no idle rule', () => {
  const changes = [
    f => f.line.variants[1].triggerIds = [],
    f => f.line.variants[1].selection.rules = false,
    f => f.policy.variants[0].use = 'manual',
    f => f.policy.variants[0].use = 'openclaw',
    f => f.policy.variants = [],
    f => f.line.variants[0].videoGenerationId = null,
    f => f.inventory.videos[0].available = false,
    f => f.inventory.videos[1].available = false,
    f => f.inventory.videos[1].dealer = 'astrid',
    f => f.inventory.videos[1].classification.eventId = 'speak.goodluck',
  ];
  for (const change of changes) { const f = fixture(); change(f); assert.equal(f.select(), null); }
});

test('rule selection keeps common priority ordering including the unconditional baseline', () => {
  const f = fixture();
  f.line.variants[1].priority = -1;
  assert.equal(f.select(), null);
  f.line.variants[1].priority = 50;
  f.line.variants.push({ ...structuredClone(f.line.variants[1]), id: 'linnea.idle.ready.aaa', priority: 60 });
  assert.equal(f.select().variantId, 'linnea.idle.ready.aaa');
});

test('simulated context never becomes a production rule and hidden cards stay projected out', () => {
  const f = fixture(), trigger = f.project.triggers.find(row => row.id === 'idle.box3');
  Object.assign(trigger, { path: 'context.chat.signal', category: 'social', value: 'none' });
  assert.equal(f.select(), null, 'even the default no-chat signal is not observed evidence');
  Object.assign(trigger, { path: 'event.card.r', category: 'deterministic', value: 'A' });
  const sourceEvent = structuredClone(f.project.events.find(row => row.id === 'deal.dealer').exampleEvent);
  sourceEvent.faceDown = true; sourceEvent.card = { r: 'A', s: '♠' };
  assert.equal(f.select({ sourceEvent }), null);
  sourceEvent.faceDown = false;
  assert.equal(f.select({ sourceEvent }).videoId, uuid(2));
  const reveal = structuredClone(f.project.events.find(row => row.id === 'reveal.dealer').exampleEvent);
  reveal.card = { r: 'A', s: '♠' };
  assert.equal(f.select({ sourceEvent: reveal }).videoId, uuid(2));
});

test('published rule, trigger and idle media stay frozen after draft changes', () => {
  const f = fixture(), lane = defaultPresentationLane('linnea');
  f.project.lanes=[lane];
  lane.id = 'johns-linnea'; lane.dealers = ['linnea'];
  lane.layers.dealer = { enabled: true, default: 'linnea', allowed: ['linnea'] };
  validateProject(f.project);
  const captured = captureFrozenPresentation({ snapshot: {
    projectDocument: { kind: 'project', revision: f.project.revision, value: f.project },
    administrationDocument: { kind: 'administration', revision: 'admin-1', value: { rooms: [] } },
    mediaRows: f.records.map(row => ({ ...row, revision: 'media-1' })),
  }, inventory: f.inventory, selectedLaneIds: [lane.id], requiredIdleDealerIds: ['linnea'] });
  const project = frozenPlaybackProject(captured.presentation.playback, {
    registeredDealers: captured.presentation.registeredDealers, projectRevision: captured.presentation.projectRevision });
  f.policy.variants[0].use = 'manual'; f.project.triggers.find(row => row.id === 'idle.box3').value = 4;
  assert.equal(selectRegisteredIdleRule({ project, dealerId: 'linnea', sourceEvent: f.sourceEvent, mode: 'rules' }, { inventory: f.inventory }).videoId, uuid(2));
});

test('a matching rule waits for action completion and a complete base boundary then resumes the same own base', () => {
  const h = controllerFixture(), c = h.controller;
  const result = h.select();
  assert.equal(result.videoId, uuid(2));
  assert.equal(c.updateScene({ actionBusy: true }).state, 'blocked');
  assert.equal(h.offer('while-busy'), false);
  assert.equal(c.updateScene({ actionBusy: false }).clip.videoId, uuid(1));
  assert.equal(h.offer('after-action'), true);
  assert.equal(c.snapshot().clip.videoId, uuid(1), 'offer cannot interrupt the current base');
  const variation = h.complete();
  assert.equal(variation.videoId, uuid(2)); assert.equal(variation.reason, 'rules');
  assert.equal(h.complete().videoId, uuid(1));
  assert.equal(h.offer('quota'), false, 'same rolling quota applies to rule and OpenClaw reactions');
});

test('missing explicit trigger leaves the controller on the base with no timer-created reaction', () => {
  const h = controllerFixture();
  h.line.variants[1].triggerIds = [];
  assert.equal(h.select(), null);
  for (let index = 0; index < 65; index++) assert.equal(h.complete().videoId, uuid(1));
  assert.equal(h.offer('wrong-use', 75000, { use: 'openclaw' }), false);
  assert.equal(h.offer('wrong-mode', 75000, { use: 'automatic' }), false);
});

test('rule offers expire, obey speech gates and are invalidated by scene revision or mode change', () => {
  for (const patch of [{ speechReady: true }, { speechPlaying: true }, { visible: false }, { active: false }]) {
    const h = controllerFixture(); h.controller.updateScene(patch); assert.equal(h.offer(), false);
  }
  const expired = controllerFixture();
  assert.equal(expired.offer('expire', 500), true);
  assert.equal(expired.complete().videoId, uuid(1));
  const selected = controllerFixture(); selected.offer('selected', 2000); selected.complete(); selected.at(2001);
  assert.equal(selected.controller.started(selected.controller.snapshot().clip.playId).clip.videoId, uuid(1));
  const revision = controllerFixture(); revision.offer(); revision.complete();
  assert.equal(revision.controller.updateScene({ revision: 'new' }).clip.videoId, uuid(1));
  const queued = controllerFixture(); queued.offer(); queued.controller.clearOffers();
  assert.equal(queued.complete().videoId, uuid(1));
  const chosen = controllerFixture(); chosen.offer(); chosen.complete();
  assert.equal(chosen.controller.clearOffers().clip.videoId, uuid(1));
  const playing = controllerFixture(); playing.offer(); const clip = playing.complete();
  playing.controller.presented(clip.playId);
  assert.equal(playing.controller.clearOffers().clip.videoId, uuid(2), 'mode change does not cut already started media');
  assert.equal(playing.complete().videoId, uuid(1));
});


test('Astrid legacy idle policy resolves through the same accessor without leaking to another dealer',()=>{
  const f=fixture();f.project.idlePolicy={...structuredClone(f.policy),familyId:'astrid/idle.ready/ready'};
  assert.equal(registeredIdlePolicy(f.project,'astrid'),null,'no unrelated default policy without its bound base');
  f.project.lines.push({...structuredClone(f.line),dealerId:'astrid'});
  assert.equal(registeredIdlePolicy(f.project,'astrid'),f.project.idlePolicy);
  assert.equal(registeredIdlePolicy(f.project,'linnea'),f.policy);
  assert.equal(registeredIdlePolicy(f.project,'nora'),null);
  const own={...structuredClone(f.project.idlePolicy),variants:[]};
  f.project.dealerIdlePolicies.push({dealerId:'astrid',policy:own});
  assert.equal(registeredIdlePolicy(f.project,'astrid'),own,'explicit dealer policy has precedence');
});

// Game events trigger OpenClaw for an idle reaction without chat (the shared table has none).
// The Director is a local stub here: no Gateway, no network.
import { createIdleAdviceService, idleGameEvent } from '../packages/presentation/server/idle-advice.mjs';
import { normalizeInput, prepareDecision, finalizeDecision, SOURCE_TYPES } from '../packages/director/engine.mjs';
import { buildRuntimeCatalog } from '../packages/presentation/contracts/studio-model.mjs';
import { isDealerId } from '../packages/presentation/contracts/dealer-identity.mjs';
import { selectSharedRoomPresentation } from '../services/game/shared-room-presentation-selection.mjs';

const settle = (hands, dealerTotal = 19) => ({ type: 'settle', dealerTotal, dealerBlackjack: false, hands });
const hand = (outcome, stake = 10, returned = { win: 20, blackjack: 25, push: 10, lose: 0 }[outcome]) => ({ box: 3, stake, returned, outcome });
function adviceFixture({ answer = prepared => prepared.eligible.find(row => row.priority === 10)?.id ?? null } = {}) {
  const f = fixture();
  f.policy.variants[0].use = 'openclaw'; f.policy.variants[0].description = 'jublar kort med händerna';
  validateProject(f.project);
  for (const video of f.inventory.videos) video.fileName = video.id + '.mp4';
  const idleInventory = registeredIdleInventory(f.inventory, { dealerId: 'linnea', policy: f.policy });
  const asked = [];
  const director = { normalizeInput, prepareDecision, finalizeDecision, SOURCE_TYPES, remoteRequest: () => assert.fail('no remote Director'),
    askDirector: async prepared => { asked.push(prepared);
      return { advice: { requestId: prepared.requestId, catalogRevision: prepared.catalogRevision, variantId: answer(prepared) },
        provider: { status: 'responded', contextContractVersion: 2, observedChatMessages: prepared.context.observedChat?.messages.length ?? 0 } }; } };
  const service = createIdleAdviceService({ director, projectModel: { buildRuntimeCatalog, validateProject, registeredIdlePolicy, isDealerId },
    settings: {}, videoRegistry: idleInventory });
  // As the shared-table selection calls it; an HTTP body never carries committedEvent.
  const advise = (body, options = {}) => service(body, { committedEvent: true, ...options });
  return { ...f, idleInventory, asked, service, advise };
}
const gameBody = (f, event, patch = {}) => ({ requestId: 'game-1', project: structuredClone(f.project), dealerId: 'linnea', mode: 'active',
  sourceRef: { kind: 'game-event', channel: 'room:a', revision: 4, messageId: 'event:1', at: new Date().toISOString(), event: idleGameEvent(event) },
  gameEvent: event, ...patch });

test('a committed turn or settlement is named for its idle reaction; stakes size the win only', () => {
  assert.equal(idleGameEvent({ type: 'turn', box: 3, handIndex: 0, legalActions: ['stand'] }), 'turn');
  assert.equal(idleGameEvent(settle([hand('blackjack'), hand('lose')])), 'blackjack');
  assert.equal(idleGameEvent(settle([hand('win')], 24)), 'dealer-bust');
  assert.equal(idleGameEvent(settle([hand('win'), hand('win', 20, 40)])), 'win-big');
  assert.equal(idleGameEvent(settle([hand('win'), hand('lose')])), 'win-small');
  assert.equal(idleGameEvent(settle([hand('push'), hand('push')])), 'push');
  assert.equal(idleGameEvent(settle([hand('lose'), hand('push')])), 'lose');
  for (const event of [{ type: 'deal' }, { type: 'idle' }, settle([]), null]) assert.equal(idleGameEvent(event), null);
});

test('OpenClaw answers a game event without chat: active returns the clip, shadow only the would-be choice', async () => {
  const event = settle([hand('win'), hand('win', 20, 40)]);
  for (const mode of ['active', 'shadow']) {
    const f = adviceFixture(), result = await f.advise(gameBody(f, event, { mode }));
    assert.equal(result.provider, 'responded');
    assert.deepEqual([result.videoId, result.wouldChooseId], [mode === 'active' ? uuid(2) : null, uuid(2)]);
    assert.deepEqual(result.contextReceipt, { contractVersion: 2, observedChatMessages: 0 });
    const sent = f.asked[0];
    assert.equal(sent.node.id, 'idle-reaction.win-big.linnea');
    assert.deepEqual(sent.event, { type: 'settle', dealerTotal: 19, dealerBlackjack: false, hands: [{ box: 3, outcome: 'win' }, { box: 3, outcome: 'win' }] },
      'the Director sees the public result, never stakes or returns');
    assert.equal(sent.context.observedChat, undefined);
    assert.match(sent.eligible.find(row => row.priority === 10).label, /jublar kort med händerna/);
  }
  const abstains = adviceFixture({ answer: () => null });
  assert.equal((await abstains.advise(gameBody(abstains, event))).videoId, null);
});

test('a game event must be a committed turn or settlement whose name matches; nothing reaches the Director otherwise', async () => {
  const f = adviceFixture(), event = settle([hand('win')]);
  const refused = [
    gameBody(f, event, { gameEvent: settle([hand('lose')]) }),
    gameBody(f, { type: 'deal', to: 'dealer', box: null, faceDown: true, clip: { action: 'deal-dealer' }, card: null }),
    { ...gameBody(f, event), sourceRef: { ...gameBody(f, event).sourceRef, event: 'player-joined' } },
    (({ gameEvent, ...rest }) => rest)(gameBody(f, event)),
    gameBody(f, event, { observedChat: { source: 'native-observation', before: new Date().toISOString(), messages: [] } }),
    gameBody(f, event, { mode: 'rules' }),
  ];
  for (const body of refused) await assert.rejects(f.advise(body), /idle_advice_invalid/);
  // The idle-advice HTTP routes pass client bodies without committedEvent: a claimed game event is refused.
  await assert.rejects(f.service(gameBody(f, event)), /idle_advice_invalid_request/);
  await assert.rejects(f.advise({ ...gameBody(f, event), sourceRef: { ...gameBody(f, event).sourceRef, kind: 'renderer-idle' } }), /idle_advice_invalid_source/);
  assert.equal(f.asked.length, 0);
});

function sharedRoomFixture(idleMode, adviseIdle) {
  const f = adviceFixture(), context = { operatorSlug: 'north', roomId: 'room-a', packageRevision: 7, dealerId: 'linnea' };
  const frozen = { context, dealer: { id: 'linnea' }, project: f.project, inventory: { videos: structuredClone(f.inventory.videos), families: [] },
    idleInventory: f.idleInventory, projectRevision: 'frozen-7', configurationSource: 'operator-package-v3', lane: { openclaw: { idle: idleMode } } };
  const material = { revision: 'casual-' + 'a'.repeat(16), dealerId: 'linnea', language: 'sv', leadMs: 1000, cardMs: 1000,
    media: f.records.map(row => ({ id: row.id, sha256: row.sha256 })) };
  const logged = [];
  const run = async sourceEvent => selectSharedRoomPresentation({
    capture: { sourceEvent, published: [sourceEvent], material, version: 4, roomId: 'room-a', talkId: 'talk-4', language: 'sv', presentationContext: context, packageRevision: 7 },
    body: { dealerId: 'linnea', mode: idleMode, version: 4, event: sourceEvent, presentationContext: context, sharedRoom: { roomId: 'room-a', ver: 4, talkId: 'talk-4' } },
    frozenDealerContext: { resolve: async () => frozen, publicVideo: () => null }, select: async () => assert.fail('no media for a game event'),
    request: null, playerId: 'alice', signal: new AbortController().signal, adviseIdle: adviseIdle ?? f.service, log: entry => logged.push(entry) });
  return { f, run, logged };
}

test('the shared table asks OpenClaw at turn and settlement when idle is active or shadow, and never otherwise', async () => {
  const turn = { type: 'turn', box: 3, handIndex: 0, legalActions: ['hit', 'stand'] }, won = settle([hand('blackjack')]);
  for (const mode of ['active', 'shadow']) for (const event of [turn, won]) {
    const s = sharedRoomFixture(mode), answer = await s.run(event);
    assert.equal(answer.video, null);
    assert.deepEqual({ ...answer.idleAdvice, expiresAt: typeof answer.idleAdvice.expiresAt },
      { requestId: answer.decision.requestId, mode, event: idleGameEvent(event), videoId: mode === 'active' ? uuid(2) : null, wouldChooseId: uuid(2),
        provider: 'responded', expiresAt: 'string', version: 4, presentationContext: { operatorSlug: 'north', roomId: 'room-a', packageRevision: 7, dealerId: 'linnea' } });
    assert.equal(s.f.asked[0].node.id, `idle-reaction.${idleGameEvent(event)}.linnea`);
    assert.deepEqual(s.logged.map(row => [row.event, row.mode, row.reaction, row.videoId, row.wouldChooseId]),
      [['idle_game_event_advice', mode, idleGameEvent(event), mode === 'active' ? uuid(2) : null, uuid(2)]]);
    assert.equal(JSON.stringify(s.logged).includes('alice'), false, 'the log names no player');
  }
  for (const mode of ['off', 'rules', 'random']) {
    const s = sharedRoomFixture(mode, () => assert.fail('no OpenClaw call in mode ' + mode)), answer = await s.run(won);
    assert.equal(Object.hasOwn(answer, 'idleAdvice'), false);assert.equal(s.logged.length, 0);
  }
  // Optional advice: a provider failure leaves the committed event's answer intact.
  const failing = sharedRoomFixture('active', async () => { throw new Error('gateway down'); }), answer = await failing.run(won);
  assert.equal(Object.hasOwn(answer, 'idleAdvice'), false);assert.deepEqual(answer.decision.sourceEvent, won);
});
