import {readFile, lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {QA_PUBLIC_ORIGIN, verifyUnpaidWssTransport} from './qa-stream-transport-preload.mjs';

const CREDENTIALS = new URL('../../apps/studio/data/platform-private/qa-operator.json', import.meta.url);
const PATHS = new Set(['/studio/api/auth/login', '/api/bo/speech-qa']);
const SAFE_NETWORK_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPROTO', 'ERR_TLS_CERT_ALTNAME_INVALID', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE']);
const SAFE_TRANSPORT_GATES = new Set(['client_timeout', 'client_upgrade', 'client_socket', 'client_binary', 'client_protocol', 'client_terminal']);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function fail(gate, fields = {}) {
  throw Object.assign(Error('Isolated unpaid WSS gate failed.'), {gate, ...fields});
}
function validateCredentials(value) {
  if (typeof value?.username !== 'string' || !value.username || value.username.length > 256
      || typeof value.password !== 'string' || !value.password || value.password.length > 256) fail('private_credentials');
  return {username: value.username, password: value.password};
}
function safeTransportFailure(error) {
  return {...(SAFE_TRANSPORT_GATES.has(error?.gate) ? {transportGate: error.gate} : {}),
    ...(typeof error?.accepted === 'boolean' ? {accepted: error.accepted} : {}),
    ...(Number.isInteger(error?.statusCode) ? {statusCode: error.statusCode} : {}),
    ...(Number.isInteger(error?.closeCode) ? {closeCode: error.closeCode} : {}),
    ...(SAFE_NETWORK_CODES.has(error?.networkCode) ? {networkCode: error.networkCode} : {})};
}
function backendCode(value) {
  return /^(?:operator_speech_qa_|generated_speech_)[a-z_]+$/.test(value?.error ?? '') ? value.error : 'backend_refused';
}

/** Executes only on the fixed, isolated QA origin. Credentials, cookies and
 * prepared tickets remain in memory; the returned evidence contains none. */
export async function runUnpaidWssGate({credentials, fetchImpl = fetch, verifyTransport = verifyUnpaidWssTransport, wait = pause} = {}) {
  const {username, password} = validateCredentials(credentials);
  const completed = [];
  let ownerCookie, needsCleanup = false;
  async function request(path, {method = 'GET', cookie, body, gate} = {}) {
    if (!PATHS.has(path)) fail('client_route');
    let response;
    try {
      response = await fetchImpl(QA_PUBLIC_ORIGIN + path, {method, redirect: 'error', signal: AbortSignal.timeout(45000),
        headers: {'Origin': QA_PUBLIC_ORIGIN, 'Sec-Fetch-Site': 'same-origin', ...(cookie ? {Cookie: cookie} : {}),
          ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    } catch (error) {
      const networkCode = error?.code ?? error?.cause?.code;
      fail(gate, {...(SAFE_NETWORK_CODES.has(networkCode) ? {networkCode} : {}), failure: 'http_transport'});
    }
    // Never follow redirects to a provider, production origin or another host.
    if (response.redirected || (response.url && new URL(response.url).origin !== QA_PUBLIC_ORIGIN)) fail(gate, {failure: 'foreign_response'});
    let value;
    try {value = await response.json();} catch {fail(gate, {statusCode: response.status, failure: 'invalid_json'});}
    if (response.status !== 200) fail(gate, {statusCode: response.status, backendCode: backendCode(value)});
    return {response, value};
  }
  async function login(gate) {
    const {response, value} = await request('/studio/api/auth/login', {method: 'POST', body: {user: username, pass: password}, gate});
    const values = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? ''];
    const sessions = values.filter(value => value.startsWith('bo_jwt='));
    if (value.ok !== true || sessions.length !== 1 || !/^bo_jwt=[A-Za-z0-9_.-]{1,8192};/.test(sessions[0])) fail(gate, {statusCode: response.status, failure: 'session_cookie_missing'});
    const cookie = sessions[0].split(';')[0];
    if (!['admin', 'superadmin'].includes(value.role)) fail(`${gate}_current_role`, {statusCode: 200, failure: 'operator_role_required'});
    completed.push({gate, statusCode: 200, currentRole: value.role});
    return cookie;
  }
  async function prepare(turn, gate) {
    needsCleanup = true;
    const {value} = await request('/api/bo/speech-qa', {method: 'POST', cookie: ownerCookie, body: {turn}, gate});
    const descriptor = value.decision?.speechStream;
    if (descriptor?.kind !== 'generated-speech-stream' || descriptor.url !== '/speech-stream') fail(gate, {statusCode: 200, failure: 'stream_descriptor_missing'});
    completed.push({gate, statusCode: 200, attempt: value.attempt});
    return descriptor;
  }
  async function denied(cookie, descriptor, gate) {
    try {await verifyTransport({cookie, descriptor});}
    catch (error) {
      const fields = safeTransportFailure(error);
      if (fields.statusCode === 401 && fields.accepted !== true) {completed.push({gate, denied: true, statusCode: 401}); return;}
      fail(gate, {...fields, failure: 'expected_upgrade_401'});
    }
    fail(gate, {accepted: true, failure: 'unauthorized_stream_accepted'});
  }
  async function cleanup() {
    await request('/api/bo/speech-qa', {method: 'DELETE', cookie: ownerCookie, gate: 'cleanup'});
    needsCleanup = false;
    completed.push({gate: 'cleanup', statusCode: 200});
  }
  let result, failure;
  try {
    ownerCookie = await login('owner_login');
    const {value: state} = await request('/api/bo/speech-qa', {cookie: ownerCookie, gate: 'operator_gate'});
    if (!state.enabled || state.maxAttempts - state.attempts < 2 || state.pending || state.relay?.busy || state.relay?.pending) fail('operator_gate', {statusCode: 200, failure: 'operator_gate_unavailable'});
    completed.push({gate: 'operator_gate', statusCode: 200, attemptsRemaining: state.maxAttempts - state.attempts});
    // BO JWTs are deterministic within one second. The second actual login
    // must be a different valid session to test exact cookie ownership.
    await wait(1100);
    const foreignCookie = await login('foreign_session_login');
    if (foreignCookie === ownerCookie) fail('foreign_session_login', {failure: 'distinct_session_required'});
    const descriptor = await prepare(1, 'owner_prepare');
    let transport;
    try {transport = await verifyTransport({cookie: ownerCookie, descriptor});}
    catch (error) {fail('owner_stream', safeTransportFailure(error));}
    if (transport.accepted !== true || transport.workerRoundTrip !== true || transport.syntheticTransport !== true || transport.actualPlayback !== false) fail('owner_stream', {failure: 'transport_evidence_missing'});
    completed.push({gate: 'owner_stream', ...transport});
    await denied(ownerCookie, descriptor, 'ticket_replay');
    await cleanup();
    const freshDescriptor = await prepare(2, 'foreign_session_prepare');
    await denied(foreignCookie, freshDescriptor, 'foreign_session_ticket');
    result = {accepted: true, origin: QA_PUBLIC_ORIGIN, syntheticTransport: true, actualPlayback: false};
  } catch (error) {failure = error;}
  finally {
    if (needsCleanup && ownerCookie) {
      try {await cleanup();}
      catch (error) {if (!failure) failure = error; else completed.push({gate: 'cleanup', failed: true, ...(Number.isInteger(error.statusCode) ? {statusCode: error.statusCode} : {})});}
    }
  }
  if (failure) {
    const fields = {gate: typeof failure.gate === 'string' ? failure.gate : 'client', completed,
      ...safeTransportFailure(failure), ...(typeof failure.transportGate === 'string' && SAFE_TRANSPORT_GATES.has(failure.transportGate) ? {transportGate: failure.transportGate} : {}),
      ...(typeof failure.failure === 'string' ? {failure: failure.failure} : {}),
      ...(/^(?:operator_speech_qa_|generated_speech_)[a-z_]+$/.test(failure.backendCode ?? '') || failure.backendCode === 'backend_refused' ? {backendCode: failure.backendCode} : {})};
    throw Object.assign(Error('Isolated unpaid WSS gate failed.'), fields);
  }
  return {...result, completed};
}

export async function mainUnpaidWssGate(args = process.argv.slice(2)) {
  if (args.length !== 1 || args[0] !== '--live') fail('explicit_live_flag_required');
  let credentials;
  try {
    const info = await lstat(CREDENTIALS);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 8192) fail('private_credentials');
    credentials = validateCredentials(JSON.parse(await readFile(CREDENTIALS, 'utf8')));
  } catch {fail('private_credentials');}
  return runUnpaidWssGate({credentials});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mainUnpaidWssGate().then(result => {console.log(JSON.stringify(result));}).catch(error => {
    const {gate, statusCode, closeCode, networkCode, transportGate, accepted, failure, backendCode, completed} = error;
    console.error(JSON.stringify({accepted: false, gate, statusCode, closeCode, networkCode, transportGate,
      ...(accepted === undefined ? {} : {upgradeAccepted: accepted}), failure, backendCode, completed}));
    process.exitCode = 1;
  });
}
