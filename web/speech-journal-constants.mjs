// Shared bounded GPU reservation window; pure data, no storage/runtime imports.
export const GPU_RESERVATION_WINDOW_MS = 720000;
export const FULLFILE_PROVIDER_MAX_TIMEOUT_MS = 300000;
export const FULLFILE_RUNPOD_POLICY = Object.freeze({ executionTimeout:120000, ttl:180000 });
// A lost POST acknowledgement can consume the whole local deadline before an
// accepted remote job reaches its independent TTL. Never admit another POST
// unless both intervals fit inside the original reservation's UTC coverage.
export const FULLFILE_ADMISSION_REMAINING_MS = FULLFILE_PROVIDER_MAX_TIMEOUT_MS + FULLFILE_RUNPOD_POLICY.ttl;
