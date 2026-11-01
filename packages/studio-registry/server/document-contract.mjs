import { createStudioDocumentContract } from './storage-contract.mjs';
import { validateProject } from '../../presentation/contracts/studio-model.mjs';
import { gameLaneConfiguration } from '../../presentation/contracts/game-lanes.mjs';
export * from './storage-contract.mjs';
// Read/export/restore compatibility for the remaining persisted social-policy.
// Its interactive API and model runtime are retired; no default document is created.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const string = (value, max, allowEmpty = false) => typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0);
const canonicalText = value => typeof value === 'string' ? value.trim().replace(/\r\n?/g, '\n') : value;
// Preserve the historical text contract: LF is allowed, other C0/C1 bytes are not.
const ttsText = (value, allowEmpty = false) => string(value, 500, allowEmpty)
  && value === canonicalText(value) && !/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(value);
const unit = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const inputError = code => { throw new TypeError(code); };

// Pure shared validators: no environment reads, I/O, mutation or model calls.
function validateSocialPolicy(policy) {
  if (!exact(policy, ['schemaVersion', 'revision', 'trigger', 'response', 'cooldownMs'])
    || policy.schemaVersion !== 1 || !string(policy.revision, 100)
    || !Number.isInteger(policy.cooldownMs) || policy.cooldownMs < 0 || policy.cooldownMs > 300000) inputError('invalid_social_policy');
  const { trigger, response } = policy;
  if (!exact(trigger, ['id', 'label', 'enabled', 'directive', 'threshold'])
    || trigger.id !== 'social.ledsen' || !string(trigger.label, 80) || typeof trigger.enabled !== 'boolean'
    || !string(trigger.directive, 1000) || !unit(trigger.threshold)) inputError('invalid_social_trigger');
  if (!exact(response, ['mode', 'fixedText']) || !['fixed', 'free'].includes(response.mode)) inputError('invalid_social_response_policy');
  const fixedText = canonicalText(response.fixedText);
  if (!ttsText(fixedText, response.mode === 'free')) inputError('invalid_social_response_policy');
  return {
    schemaVersion: 1, revision: policy.revision,
    trigger: { id: trigger.id, label: trigger.label, enabled: trigger.enabled, directive: trigger.directive, threshold: trigger.threshold },
    response: { mode: response.mode, fixedText }, cooldownMs: policy.cooldownMs,
  };
}

export const { validateDocumentValue, validateSnapshot } = createStudioDocumentContract({
  validateProject, validateSocialPolicy, gameLaneConfiguration,
});
