import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Kevin o1792873491724: the demo's strict gate, off unless DEMO_GATE_STRICT=1
test('the strict demo gate is only on with DEMO_GATE_STRICT=1 and answers 401 before the redirects, on the page, the room WS and the game API', () => {
  const src = readFileSync(new URL('../server/server.mjs', import.meta.url), 'utf8');
  assert.match(src, /const DEMO_GATE_STRICT = process\.env\.DEMO_GATE_STRICT === "1";/);
  assert.match(src, /if\(DEMO_GATE_STRICT&&demoGate\.on&&\['table','chat'\]\.includes\(route\)\)/);
  assert.match(src, /if\(shared&&DEMO_GATE_STRICT&&demoGate\.on\)\{[^\n]*strictDenied\(res\);\}\n  if\(shared\)\{/);
  assert.match(src, /if\(file===path\.join\(PUBLIC,"index\.html"\)&&DEMO_GATE_STRICT&&demoGate\.on\)\{[^\n]*strictDenied\(res\);\}[^\n]*\n  if\(file===path\.join\(PUBLIC,"index\.html"\)\)\{/);
  assert.match(src, /if\(!\(DEMO_GATE_STRICT&&demoGate\.on\)\)return join\(\);/);
});
