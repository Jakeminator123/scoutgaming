import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTriggerValue } from './trigger-value.mjs';

test('enum null stays null, not the string null', () => {
  assert.equal(parseTriggerValue('null', { kind: 'enum', values: [null, 'sv', 'de'] }, 'eq'), null);
});
test('numeric array member remains a number', () => {
  assert.equal(parseTriggerValue('3', { kind: 'array', values: [0, 1, 2, 3] }, 'includes'), 3);
});
test('boolean in supports multiple typed values', () => {
  assert.deepEqual(parseTriggerValue('true, false', { kind: 'boolean' }, 'in'), [true, false]);
});
test('numeric in supports a list rather than coercing the whole string', () => {
  assert.deepEqual(parseTriggerValue('1, 3, 5', { kind: 'number' }, 'in'), [1, 3, 5]);
});
test('numeric-looking card ranks remain strings according to their enum', () => {
  assert.equal(parseTriggerValue('10', { kind: 'enum', values: ['A', '10', 'K'] }, 'eq'), '10');
});
test('an unknown string is preserved so schema validation rejects it', () => {
  assert.equal(parseTriggerValue('not-a-mood', { kind: 'enum', values: ['calm', 'warm'] }, 'eq'), 'not-a-mood');
});
