import { randomUUID } from 'node:crypto';
import seed from '../../policies/social.seed.json' with { type: 'json' };
import { validateSocialPolicy } from '../../../../packages/director/social.mjs';
import { StudioError } from '../../lib/project-store.mjs';

export function createSocialPolicy() { return structuredClone(seed); }
export function checkedPolicy(policy) {
  try { return validateSocialPolicy(policy); }
  catch { throw new StudioError('Ogiltig social policy. Kontrollera namn, instruktion, känslighet och taltext.', 422); }
}

// Test fixture only. Neon owns the live social policy and its revisions;
// nothing here touches disk and no local history is kept.
export function createMemorySocialStore(initial = createSocialPolicy()) {
  let current = checkedPolicy(initial);
  return {
    async load() { return structuredClone(current); },
    async save(next, expectedRevision) {
      const checked = checkedPolicy(next);
      if (expectedRevision !== current.revision) throw new StudioError('Den sociala policyn har ändrats. Läs in den igen innan du sparar.', 409);
      current = { ...checked, revision: `social-${randomUUID()}` };
      return structuredClone(current);
    },
  };
}
