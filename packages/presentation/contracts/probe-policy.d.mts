export interface ProbePolicy {
  schemaVersion: 1; mode: 'off' | 'text' | 'automatic'; inactivityMs: number; cooldownMs: number;
  maxPerHour: number; probability: number; anecdoteCooldownDays: number; memoryEnabled: boolean;
  memoryDays: number; maxFacts: number; model: 'gateway-default' | 'gpt-5.4-mini' | 'gpt-6-luna' | 'gpt-5.6-terra'; reasoning: 'gateway-default';
}
export const PROBE_MODELS: readonly { id: ProbePolicy['model']; label: string }[];
export const PROBE_REASONS: Readonly<Record<string, string>>;
export function createDefaultProbePolicy(): ProbePolicy;
export function validateProbePolicy(value: unknown): ProbePolicy;
export function probePolicy(project: {probePolicy?: ProbePolicy}): ProbePolicy;
