// Shared scope and safe error identity; no Studio, media or OpenClaw imports.
const safeCode = /^(?:studio_|generated_speech_|operator_speech_|invalid_generated_|speech_|gpu_|partner_)[a-z0-9_]{1,100}$/;
const id = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/;

// Public failures contain a fixed code only, never a database/provider message.
export class StudioStorageError extends Error {
  constructor(code, statusCode = 503) {
    const bounded = typeof code === 'string' && safeCode.test(code) ? code : 'studio_storage_unavailable';
    super(bounded);
    this.name = 'StudioStorageError';
    this.code = bounded;
    this.statusCode = Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599 ? statusCode : 503;
  }
}

export function validateStudioEnvironmentId(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{0,62}$/.test(value)) throw new StudioStorageError('studio_invalid_scope', 422);
  return value;
}

export function validateStudioScope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'environment,workspaceId'
    || !['environment', 'workspaceId'].every(key => Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, 'value'))
    || typeof value.workspaceId !== 'string' || !id.test(value.workspaceId)) throw new StudioStorageError('studio_invalid_scope', 422);
  return Object.freeze({ environment: validateStudioEnvironmentId(value.environment), workspaceId: value.workspaceId });
}
