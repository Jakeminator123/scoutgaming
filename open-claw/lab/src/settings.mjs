import { fileURLToPath } from 'node:url';
import { resolve, basename, dirname } from 'node:path';
import { createDirectorSettingsReader } from '../../../packages/director/node/settings-reader.mjs';

// The service owns its filesystem root and default environment inputs.
export const LAB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ENV_FILES = basename(dirname(resolve(LAB_ROOT))) === 'open-claw'
  ? [resolve(LAB_ROOT, '../../.env'), resolve(LAB_ROOT, '.env')] : [resolve(LAB_ROOT, '.env')];

export const readSettings = createDirectorSettingsReader({ dataRoot: LAB_ROOT, defaultEnvFiles: DEFAULT_ENV_FILES });
