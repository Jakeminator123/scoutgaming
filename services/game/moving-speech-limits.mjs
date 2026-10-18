// Server-owned limits for the separately admitted moving worker. No request or
// environment value may extend these deadlines. Queue/image startup is distinct
// from the handler's execution budget; cleanup retains a provider TTL margin.
export const MOVING_SPEECH_LIMITS = Object.freeze({
  coldStartGraceMs: 300000, startupMs: 450000, lifetimeMs: 480000,
  executionMs: 180000, jobTtlMs: 540000,
  // Billed flex-worker tail, included in the original reservation window.
  // Minimum workers stays zero; this never creates an always-on GPU.
  providerIdleMs: 60000,
});
// Durable chat deduplication must outlive moving preparation plus its caller.
// This only retains pending locks longer; it grants no extra execution or spend.
export const CHAT_PENDING_LIFETIME_MS = 600000;
