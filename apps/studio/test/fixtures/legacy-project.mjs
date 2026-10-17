// Retired demo data, retained only for migration/backward-compatibility tests.
import seed from './legacy-project.json' with { type: 'json' };
import { createDefaultIdlePolicy } from '../../../../packages/presentation/runtime/idle-policy.mjs';
import { createDefaultProbePolicy } from '../../../../packages/presentation/contracts/probe-policy.mjs';
export const createLegacyProject = () => ({ ...structuredClone(seed), idlePolicy: createDefaultIdlePolicy(), probePolicy: createDefaultProbePolicy() });
