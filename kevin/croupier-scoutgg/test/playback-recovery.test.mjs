import test from "node:test";
import assert from "node:assert/strict";
import { createPlaybackRecovery } from "../public/playback-recovery.js";

function setup(overrides = {}) {
  let plays = 0, advances = 0, soundPrompts = 0;
  const video = { paused: true, ended: false, muted: true, play: async () => { plays++; video.paused = false; } };
  const state = { video, item: { kind: "idle" }, running: true, loading: false, queued: 0, visible: true, ...overrides };
  const recover = createPlaybackRecovery({
    getState: () => state, isVisible: () => state.visible,
    advance: () => { advances++; }, onSoundBlocked: () => { soundPrompts++; },
  });
  return { state, recover, counts: () => ({ plays, advances, soundPrompts }) };
}

test("a click queued behind a browser-paused idle advances without waiting for ended", async () => {
  const t = setup({ queued: 1 });
  await t.recover();
  assert.equal(t.counts().advances, 1);
  assert.equal(t.counts().plays, 0);
});

test("a paused deal resumes instead of skipping to the next queued deal", async () => {
  const t = setup({ queued: 1, item: { kind: "event" } });
  await t.recover();
  assert.equal(t.counts().advances, 0);
  assert.equal(t.counts().plays, 1);
});

test("healthy playback, loading and hidden tabs do not advance or replay", async () => {
  for (const overrides of [{ loading: true }, { visible: false }, { running: false }]) {
    const t = setup({ queued: 1, ...overrides });
    await t.recover();
    assert.deepEqual(t.counts(), { plays: 0, advances: 0, soundPrompts: 0 });
  }
  const t = setup({ queued: 1 });
  t.state.video.paused = false;
  await t.recover();
  assert.equal(t.counts().advances, 0);
});

test("a visible paused idle restarts; a missed ended advances", async () => {
  const t = setup();
  await t.recover();
  assert.equal(t.counts().plays, 1);
  t.state.video.paused = true;
  t.state.video.ended = true;
  await t.recover();
  assert.equal(t.counts().advances, 1);
});

test("concurrent watchdog and gesture resume calls do not race", async () => {
  const t = setup();
  let resolvePlay, calls = 0;
  t.state.video.play = () => { calls++; return new Promise(resolve => { resolvePlay = resolve; }); };
  const first = t.recover();
  await t.recover();
  assert.equal(calls, 1);
  resolvePlay();
  await first;
});

test("denied audio falls back to muted video and offers sound again", async () => {
  const t = setup({ item: { kind: "line" } });
  t.state.video.muted = false;
  let calls = 0;
  t.state.video.play = async () => { if (++calls === 1) throw new Error("NotAllowedError"); };
  await t.recover();
  assert.equal(calls, 2);
  assert.equal(t.state.video.muted, true);
  assert.equal(t.counts().soundPrompts, 1);
});

test("a rejected resume cannot mute a replacement clip that is loading", async () => {
  const t = setup({ item: { kind: "line" } });
  t.state.video.muted = false;
  let rejectPlay;
  t.state.video.play = () => new Promise((resolve, reject) => { rejectPlay = reject; });
  const first = t.recover();
  t.state.loading = true;
  rejectPlay(new Error("AbortError"));
  await first;
  assert.equal(t.state.video.muted, false);
  assert.equal(t.counts().soundPrompts, 0);
});
