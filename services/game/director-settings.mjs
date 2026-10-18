import { fileURLToPath } from 'node:url';
import { resolve, basename, dirname } from 'node:path';
import { createDirectorSettingsReader } from '../../packages/director/node/settings-reader.mjs';

// Preserve the established Director data root/default file policy explicitly.
// The game retains its existing root/service environment-file policy.
const DIRECTOR_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../open-claw/lab');
const DEFAULT_ENV_FILES = basename(dirname(resolve(DIRECTOR_ROOT))) === 'open-claw'
  ? [resolve(DIRECTOR_ROOT, '../../.env'), resolve(DIRECTOR_ROOT, '.env')] : [resolve(DIRECTOR_ROOT, '.env')];

export const readSettings = createDirectorSettingsReader({ dataRoot: DIRECTOR_ROOT, defaultEnvFiles: DEFAULT_ENV_FILES });
