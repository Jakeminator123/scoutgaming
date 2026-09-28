import seed from '../policies/probe-policy.seed.json' with { type: 'json' };

export const PROBE_MODELS = Object.freeze([
  { id: 'gateway-default', label: 'Gatewayns nuvarande talmodell' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini · jämförelse' },
  { id: 'gpt-6-luna', label: 'GPT-6 Luna · snabb kandidat' },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra · kvalitetskandidat' },
]);
export const PROBE_REASONS = Object.freeze({
  off: 'Probe är avstängt', text: 'Textprov körs med provknappen', inactive: 'Väntar på inaktivitet',
  quiet: 'Väntar på lugnt läge', absent: 'Spelaren är inte närvarande', muted: 'Proaktivt tal eller ljud är avstängt',
  cooldown: 'Paus mellan repliker', hourly: 'Timtaket är nått', sampled: 'Detta tillfälle är redan prövat',
  chance: 'Slumpen valde tystnad', busy: 'Ett initiativ förbereds', no_memory: 'Saknar ett relevant minne',
  repeated: 'Redan sagt', silence: 'Astrid valde tystnad', generated: 'Tal klart, väntar på uppspelning',
  played: 'Spelade probe', cancelled: 'Initiativet är inte längre aktuellt', failed: 'Provet kunde inte slutföras',
  interrupted: 'Förra försöket avbröts', reserved: 'Förbereder en probe',
});
export function createDefaultProbePolicy() { return structuredClone(seed); }
export function validateProbePolicy(value) {
  const fail = () => { throw Object.assign(new Error('Ogiltig Probe-policy.'), { statusCode: 400 }); };
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== Object.keys(seed).length || Object.keys(seed).some(key => !Object.hasOwn(value, key))) fail();
  if (value.schemaVersion !== 1 || !['off', 'text', 'automatic'].includes(value.mode)
    || typeof value.memoryEnabled !== 'boolean' || !PROBE_MODELS.some(model => model.id === value.model)
    || value.reasoning !== 'gateway-default') fail();
  for (const [key, min, max] of [['inactivityMs', 1000, 3600000], ['cooldownMs', 1000, 86400000],
    ['maxPerHour', 1, 12], ['anecdoteCooldownDays', 1, 30], ['memoryDays', 1, 30], ['maxFacts', 1, 20]]) {
    if (!Number.isSafeInteger(value[key]) || value[key] < min || value[key] > max) fail();
  }
  if (typeof value.probability !== 'number' || !Number.isFinite(value.probability) || value.probability < 0 || value.probability > 1) fail();
  return value;
}
export function probePolicy(project) { return validateProbePolicy(project.probePolicy ?? createDefaultProbePolicy()); }
