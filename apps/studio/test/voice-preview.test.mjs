import test from 'node:test';
import assert from 'node:assert/strict';
import { generateVoicePreview, voicePreviewStatus } from '../lib/voice-preview.mjs';

test('retired standalone voice rejects caller configuration without inspecting it or contacting providers', async () => {
  const forbidden = new Proxy({}, { get() { assert.fail('Retired preview must not inspect settings or providers.'); } });
  assert.deepEqual(voicePreviewStatus(forbidden), { configured: false });
  await assert.rejects(generateVoicePreview(forbidden, forbidden), error => error.statusCode === 503);
});
