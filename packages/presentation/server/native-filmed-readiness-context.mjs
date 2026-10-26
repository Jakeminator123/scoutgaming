import { AsyncLocalStorage } from 'node:async_hooks';
import { StudioStorageError } from '../../studio-registry/server/document-contract.mjs';

const admission = new AsyncLocalStorage();

// Only the native preflight opens this context. No I/O is allowed here: the
// publication writer checks it while holding its existing transaction locks.
export function assertNativeFilmedPlanningReady() {
  const active = admission.getStore();
  if (active?.verified !== true || active.open !== true)
    throw new StudioStorageError('studio_presentation_runtime_update_required', 503);
}

export async function withNativeFilmedPlanningReadiness(verified, work) {
  const active = { verified: verified === true, open: true };
  return admission.run(active, async () => {
    try { return await work(); }
    finally { active.open = false; }
  });
}
