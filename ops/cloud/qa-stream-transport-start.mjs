import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {assertUnpaidQaEnvironment, QA_SERVICE_ID, QA_TRANSPORT_ORIGIN} from './qa-stream-transport-preload.mjs';

export function unpaidQaSpecifications(specifications, env) {
  assertUnpaidQaEnvironment(env);
  if (env.NODE_OPTIONS || specifications.web.env.NODE_OPTIONS) throw Error('Unpaid QA runner requires a single explicit preload.');
  const webEnvironment = {...specifications.web.env, RENDER_SERVICE_ID: QA_SERVICE_ID,
    CROUPIER_VERCEL_TRANSPORT_ORIGIN: QA_TRANSPORT_ORIGIN};
  assertUnpaidQaEnvironment(webEnvironment);
  return {...specifications, web: {...specifications.web, env: {...webEnvironment,
    NODE_OPTIONS: `--import=${new URL('./qa-stream-transport-preload.mjs', import.meta.url).href}`}}};
}

export async function mainUnpaidQa(env = process.env) {
  assertUnpaidQaEnvironment(env);
  if (env.CROUPIER_CLOUD_DATA_ROOT !== '/var/data') throw Error('Unpaid QA requires the isolated Render disk.');
  const {prepareContainerUser} = await import('./container-entry.mjs');
  await prepareContainerUser(env);
  const directory = '/var/data/speech';
  await mkdir(directory, {recursive: true, mode: 0o700});
  const createdAt = Date.now();
  // The existing operator gate is private, time bounded and tied to real BO
  // authentication. Refreshing it invalidates old operator identities.
  await writeFile(`${directory}/operator-qa.json`, JSON.stringify({id: randomUUID(), createdAt, expiresAt: createdAt + 30 * 60 * 1000}), {mode: 0o600});
  const {main} = await import('./start.mjs');
  return main(['--start'], env, {transformChildSpecifications: specifications => unpaidQaSpecifications(specifications, env)});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mainUnpaidQa().then(code => {process.exitCode = code;}).catch(() => {console.error('Isolated unpaid stream transport QA could not start.'); process.exitCode = 1;});
}
