import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { mergeDirectorEnvironment, projectDirectorSettings } from '../configuration.mjs';

// Apps choose roots and file inputs. One Node adapter owns parsing and precedence.
export function createDirectorSettingsReader({ dataRoot, defaultEnvFiles }) {
  return function readSettings({ env = process.env, envFiles = defaultEnvFiles } = {}) {
    const values = {};
    for (const path of envFiles) {
      try { mergeDirectorEnvironment(values, parseEnv(readFileSync(path, 'utf8'))); }
      catch (error) { if (error.code !== 'ENOENT') throw new Error('Could not parse lab environment file.'); }
    }
    mergeDirectorEnvironment(values, env);
    return {
      host: values.HOST || '127.0.0.1', port: Number(values.PORT || 4188),
      apiToken: values.LAB_API_TOKEN || '', dataDir: resolve(values.LAB_DATA_DIR || resolve(dataRoot, 'data')),
      ...projectDirectorSettings(values),
    };
  };
}
