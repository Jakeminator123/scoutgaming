import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSharedTable } from '../server/shared-table.mjs';

test('a visitor without a guest cookie still gets a table snapshot for the dealer chat', () => {
  const t = createSharedTable(':memory:', { manifest: JSON.parse(readFileSync(new URL('../public/media/manifest.json', import.meta.url), 'utf8')) });
  const v = t.snapshot('astrid', undefined);
  assert.equal(v.me, null);
  assert.ok(Array.isArray(v.players));
  t.close?.();
});
