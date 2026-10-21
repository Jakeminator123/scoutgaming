import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClipFilename, clipNamingGuide, clipPosesForVariant, clipVariantForPoses, CLIP_POSE_VARIANTS, SPEECH_LINE_IDS } from '../../../packages/presentation/contracts/clip-naming.mjs';
import { createSeedProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { dealerImportCatalog } from '../lib/dealer-import-catalog.mjs';

const slot = name => parseClipFilename(name).slotId;
const chain = name => { const { poses } = parseClipFilename(name); return poses ? `${poses.start}>${poses.end}` : null; };

test('Kevin take suffixes map seats and dealer cards with their pose chain', () => {
  assert.equal(slot('Kevin pos1-i.mp4'), 'deal.player.left/box0'); assert.equal(chain('Kevin pos1-i.mp4'), 'VILA>REDO');
  assert.equal(slot('Kevin pos3-iv.mp4'), 'deal.player.centre/box2'); assert.equal(chain('Kevin pos3-iv.mp4'), 'VILA>VILA');
  assert.equal(slot('Kevin pos7-v.mp4'), 'deal.player.right/box6'); assert.equal(chain('Kevin pos7-v.mp4'), 'REDO>VILA');
  assert.equal(slot('Kevin pos6.mp4'), 'deal.player.right/box5'); assert.equal(chain('Kevin pos6.mp4'), 'REDO>REDO');
  assert.equal(slot('Kevin posdealer-iv.mp4'), 'deal.dealer/dealer-up'); assert.equal(chain('Kevin posdealer-iv.mp4'), 'VILA>VILA');
  // The hole card ends in VILA by itself; -i only moves the start.
  assert.equal(slot('Kevin hole-i.mp4'), 'deal.dealer/dealer-hole'); assert.equal(chain('Kevin hole-i.mp4'), 'VILA>VILA');
  assert.equal(chain('deal_poshole.mp4'), 'REDO>VILA');
  assert.equal(slot('flip.mp4'), 'reveal.dealer/dealer-hole'); assert.equal(chain('flip.mp4'), 'VILA>VILA');
  assert.equal(parseClipFilename('Kevin pos1-i.mp4').explicitPose, true);
  assert.equal(parseClipFilename('deal_pos3.mp4').explicitPose, false);
  assert.equal(parseClipFilename('deal_pos3.mp4').canonical, false);
  assert.equal(parseClipFilename('Kevin pos1-i.mp4').canonical, true);
});

test('Swedish and English transition names carry a fixed chain and win over idle tokens', () => {
  for (const name of ['in_vila_till_redo.mp4', 'dragan_vila_till_redo.mp4', 'to-shoe.webm', 'till-skon.mp4']) {
    assert.equal(slot(name), 'transition.shoe/to-shoe', name); assert.equal(chain(name), 'VILA>REDO', name);
  }
  for (const name of ['ut_redo_till_vila.mp4', 'from-shoe.webm', 'fran-skon.mp4']) {
    assert.equal(slot(name), 'transition.shoe/from-shoe', name); assert.equal(chain(name), 'REDO>VILA', name);
  }
  assert.equal(slot('vila.mp4'), 'idle.ready/'); assert.equal(slot('Kevin V2 · andning.mp4'), 'idle.ready/');
  assert.equal(chain('idle.mp4'), null);
});

test('speech names resolve every standard line with language and take, reactions need a prefix', () => {
  for (const line of SPEECH_LINE_IDS) {
    const expected = `${['goodluck', 'insurance', 'double'].includes(line) ? `speak.${line}` : 'speak.other'}/${line}`;
    assert.equal(slot(`dragan_${line}_sv_2.mp4`), expected, line);
  }
  const parsed = parseClipFilename('Dragan · sv · goodluck_1.mp4');
  assert.equal(parsed.slotId, 'speak.goodluck/goodluck'); assert.equal(parsed.language, 'sv'); assert.equal(parsed.take, 1); assert.equal(parsed.poses, null);
  assert.equal(slot('dealerblackjack_2.mp4'), 'speak.other/dealerblackjack'); assert.equal(slot('dealerbust_1.mp4'), 'speak.other/dealerbust');
  assert.equal(slot('greet_jakob.mp4'), 'speak.other/greeting'); assert.equal(parseClipFilename('greet_jakob.mp4').take, null);
  assert.equal(slot('dragan_settle_win.mp4'), 'idle.ready/'); assert.equal(slot('dragan_reaktion_dealerbust.mp4'), 'idle.ready/');
  assert.equal(slot('dragan_settle_lose.mp4'), 'idle.ready/'); assert.equal(slot('dragan_turn.mp4'), 'idle.ready/');
  assert.equal(slot('win_1.mp4'), 'speak.other/win');
  for (const name of ['remark_hit17_1.mp4', 'table_cash_1.mp4', 'mystery.webm', 'pos8.webm', 'turnip.mp4', 'blackjacket.mp4']) assert.equal(slot(name), null, name);
  assert.deepEqual(parseClipFilename('pos1-pos2.webm').slotIds, ['deal.player.left/box0', 'deal.player.left/box1']);
  assert.equal(parseClipFilename('pos1-pos2.webm').poses, null);
});

test('pose images and variant helpers stay consistent with the four chains', () => {
  assert.equal(parseClipFilename('VILA.png', { type: 'image/png' }).slotId, 'pose/vila');
  assert.equal(parseClipFilename('redo.png', { type: 'image/png' }).slotId, 'pose/redo');
  assert.equal(parseClipFilename('vila.png', { type: 'video/mp4' }).slotId, 'idle.ready/');
  for (const [id, row] of Object.entries(CLIP_POSE_VARIANTS)) {
    assert.deepEqual(clipPosesForVariant(id), { start: row.start, end: row.end });
    assert.equal(clipVariantForPoses({ start: row.start, end: row.end }), id);
  }
  assert.equal(clipPosesForVariant('x'), null); assert.equal(clipVariantForPoses(null), null);
});

test('the naming guide covers every importable blackjack slot of the saved project', () => {
  const catalog = dealerImportCatalog(createSeedProject());
  const guided = new Set(clipNamingGuide().map(row => row.slotId));
  const missing = catalog.slots.map(row => row.id).filter(id => !guided.has(id));
  assert.deepEqual(missing, []);
  assert.deepEqual(catalog.naming.map(row => row.slotId).sort(), catalog.slots.map(row => row.id).sort());
  assert.equal(catalog.poseVariants.length, 4);
  for (const row of catalog.naming) {
    const parsed = parseClipFilename(row.example, { type: row.example.endsWith('.png') ? 'image/png' : 'video/mp4' });
    assert.equal(parsed.slotId, row.slotId, `${row.example} should resolve to ${row.slotId}`);
  }
});
