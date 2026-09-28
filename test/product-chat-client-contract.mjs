import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../web/public/app.mjs', import.meta.url), 'utf8');

test('product chat is wired to one existing speech queue through the pose gate', () => {
  assert.equal((source.match(/createSpeechQueue\s*\(/g) ?? []).length, 1);
  assert.match(source, /createSpeechPoseGate\s*\(\{/);
  assert.match(source, /enqueue:\s*rawSpeechTurn/);
  assert.match(source, /speechPoseGate\.receive\(/);
  assert.match(source, /speechPoseGate\.responseReady\(/);
  assert.doesNotMatch(source, /<i>thinking/);
});

test('chat previews model text provisionally and commits it only inside the gated callback', () => {
  assert.match(source, /sessionRevision:\s*identity\.sessionRevision/);
  assert.match(source, /roundRevision:\s*identity\.roundRevision/);
  const displayBlock = source.slice(source.indexOf('onDisplay: async'), source.indexOf('onSpeech: async'));
  assert.match(displayBlock, /chatLog\('vera', text\)/);
  assert.match(displayBlock, /previewRow\.classList\.remove\('pending'\)/);
  const sendBlock = source.slice(source.indexOf('async function sendChat'), source.indexOf("$('#gate-enter')"));
  assert.match(sendBlock, /chatLog\('vera', exactText, true\)/);
  assert.match(sendBlock, /previewRow\.remove\(\)/);
  assert.doesNotMatch(sendBlock, /chatHistory\.push\(\{ role: 'assistant'/);
});

test('generated text keeps neutral idle and exact TTS instead of a recorded mouth clip', () => {
  const playback = source.slice(source.indexOf('async function playChatDecision'), source.indexOf('function sayLine'));
  assert.match(playback, /decision\.kind === 'generatedText'/);
  assert.match(playback, /playNeutralTts\(decision\.exactText, signal\)/);
  assert.doesNotMatch(playback, /playRecorded\([^\n]*generatedText/);
  assert.doesNotMatch(source, /function speakFor\(/);
});

test('renderer evidence, not busy or phase, supplies standard-idle proof', () => {
  assert.match(source, /if \(clip === CLIP\.idle\) presentStandardIdle/);
  assert.match(source, /speechPoseGate\.presentStandardIdle\(/);
  const proofFunction = source.slice(source.indexOf('function presentStandardIdle'), source.indexOf('const engine ='));
  assert.doesNotMatch(proofFunction, /\bbusy\b|round\.phase|duration/);
});
