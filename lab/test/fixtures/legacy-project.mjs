// Retired demo data, retained only for migration/backward-compatibility tests.
import seed from './legacy-project.json' with { type: 'json' };
import { createDefaultIdlePolicy } from '../../lib/idle-policy.mjs';
import { createDefaultProbePolicy } from '../../lib/probe-policy.mjs';
export const createLegacyProject = () => ({ ...structuredClone(seed), idlePolicy: createDefaultIdlePolicy(), probePolicy: createDefaultProbePolicy() });
