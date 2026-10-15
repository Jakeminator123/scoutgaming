#!/usr/bin/env node
// Read-only provider checks. Never loads process.env, starts jobs or prints secrets.
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fail = code => { throw new Error(code); };
const profiles = Object.freeze({
  scoutgaming: { prefix: '', endpoint: 'CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID' },
  emil: { prefix: 'EMIL_', endpoint: 'EMIL_RUNPOD_ENDPOINT_ID' },
});
const providers = ['RUNPOD_API_KEY', 'CARTESIA_API_KEY', 'ELEVENLABS_API_KEY', 'GEMINI_API_KEY'];

export function readProfile(source, profile) {
  if (!Object.hasOwn(profiles, profile) || typeof source !== 'string') fail('provider_profile_invalid');
  const spec = profiles[profile];
  const names = [...source.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)].map(m => m[1]);
  if (new Set(names).size !== names.length) fail('provider_profile_duplicate_key');
  const values = parseEnv(source);
  if (profile === 'emil' && names.some(name => !name.startsWith('EMIL_'))) fail('provider_profile_mixed_names');
  if (profile === 'scoutgaming' && names.some(name => name.startsWith('EMIL_') || name === 'RUNPOD_ENDPOINT_ID')) fail('provider_profile_mixed_names');
  const keys = Object.fromEntries(providers.map(name => [name, values[spec.prefix + name] || '']));
  for (const key of Object.values(keys)) if (key && (key.length > 4096 || /\s/.test(key))) fail('provider_profile_invalid_credential');
  const endpoint = values[spec.endpoint] || '';
  if (!keys.RUNPOD_API_KEY || !/^[A-Za-z0-9_-]{1,128}$/.test(endpoint)) fail('provider_profile_runpod_pair_required');
  return { profile, keys, endpoint };
}

export async function checkProfile(configuration, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const { keys, endpoint, profile } = configuration;
  const probes = [
    ['runpod', `https://api.runpod.ai/v2/${endpoint}/health`, { Authorization: `Bearer ${keys.RUNPOD_API_KEY}` }],
    ['cartesia', 'https://api.cartesia.ai/voices', { Authorization: `Bearer ${keys.CARTESIA_API_KEY}`, 'Cartesia-Version': '2025-04-16' }, keys.CARTESIA_API_KEY],
    ['elevenlabs', 'https://api.elevenlabs.io/v1/voices', { 'xi-api-key': keys.ELEVENLABS_API_KEY }, keys.ELEVENLABS_API_KEY],
    ['gemini', 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { 'x-goog-api-key': keys.GEMINI_API_KEY }, keys.GEMINI_API_KEY],
  ];
  const results = await Promise.all(probes.map(async ([provider, url, headers, configured]) => {
    if (provider !== 'runpod' && !configured) return { provider, status: 'not_configured' };
    try {
      const response = await fetchImpl(url, { method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
      const result = { provider, status: response.ok ? 'accessible' : 'rejected', http: response.status };
      if (provider === 'runpod' && response.ok) {
        const body = await response.json();
        if (!body?.workers || typeof body.workers !== 'object') return { provider, status: 'invalid_health_response', http: response.status };
        result.workers = Object.fromEntries(['ready', 'idle', 'running', 'initializing', 'unhealthy'].filter(k => Number.isSafeInteger(body.workers[k]) && body.workers[k] >= 0).map(k => [k, body.workers[k]]));
      } else await response.body?.cancel();
      return result;
    } catch {
      return { provider, status: 'unreachable' };
    }
  }));
  return { profile, readOnly: true, speechAccepted: false, ok: results.every(r => ['accessible', 'not_configured'].includes(r.status)), results };
}

export async function main(args = process.argv.slice(2)) {
  if (args.length !== 4 || args[0] !== '--profile' || !Object.hasOwn(profiles, args[1]) || args[2] !== '--env-file' || !args[3]) {
    console.error('Usage: node tools/check-provider-profile.mjs --profile scoutgaming|emil --env-file <private-file>');
    return 2;
  }
  try {
    const configuration = readProfile(await readFile(resolve(args[3]), 'utf8'), args[1]);
    const report = await checkProfile(configuration);
    console.log(JSON.stringify(report));
    return report.ok ? 0 : 1;
  } catch (error) {
    console.error(/^provider_profile_[a-z_]+$/.test(error?.message || '') ? error.message : 'provider_profile_read_failed');
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
