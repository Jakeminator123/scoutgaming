import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createDirectorSettingsReader } from '../../../../packages/director/node/settings-reader.mjs';

// Source files move; existing local state and ordered environment inputs stay put.
export const LAB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = resolve(LAB_ROOT, '../../../open-claw/lab');
const DEFAULT_ENV_FILES = [resolve(LAB_ROOT, '../../../.env'), resolve(DATA_ROOT, '.env')];

export const readSettings = createDirectorSettingsReader({ dataRoot: DATA_ROOT, defaultEnvFiles: DEFAULT_ENV_FILES });
