// A generated-text preview is provisional until the final decision arrives.
// Media and the authoritative result arrive after the ownership/round recheck.
export const CHAT_STAGES = Object.freeze({
  text: 'Dealern tänker…', voice: 'Skapar rösten…',
  'video-submit': 'Skickar rösten till läppsynk…',
  // Keep the existing transport key for already-open clients. Preparation
  // includes voice/reference checks before a GPU reservation or queue exists.
  'video-queue': 'Förbereder röst och läppsynk…', 'video-render': 'Skapar läppsynk…',
  media: 'Förbereder uppspelning…', ready: 'Svar klart · väntar på ledigt bord',
});

export async function readChatResponse(response, onProgress = () => {}, onPreview = () => {}) {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'chat_unavailable');
    return value;
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', size = 0, decision, previewText;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 128 * 1024) throw new Error('invalid_chat_response');
      buffer += decoder.decode(value, { stream: true });
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const frame = JSON.parse(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
        if (decision) throw new Error('invalid_chat_response');
        if (frame.type === 'error') throw new Error(frame.error || 'chat_unavailable');
        if (frame.type === 'result') {
          if (previewText !== undefined && (frame.decision?.kind !== 'generatedText' || frame.decision.exactText !== previewText)) throw new Error('invalid_chat_response');
          decision = frame.decision;
        }
        else if (frame.type === 'preview' && previewText === undefined && typeof frame.exactText === 'string'
          && frame.exactText.length > 0 && frame.exactText.length <= 500 && frame.exactText === frame.exactText.trim()
          && !/[\u0000-\u001f\u007f-\u009f]/.test(frame.exactText)) {
          previewText = frame.exactText; onPreview(previewText);
        }
        else if (frame.type === 'progress' && Object.hasOwn(CHAT_STAGES, frame.stage)
          && Number.isSafeInteger(frame.elapsedMs) && frame.elapsedMs >= 0
          && (frame.metrics === undefined || (frame.stage === 'media' && frame.metrics && typeof frame.metrics === 'object'
            && !Array.isArray(frame.metrics) && Object.keys(frame.metrics).every(key => ['videoBytes', 'runpodDelayMs', 'runpodExecutionMs'].includes(key)
              && Number.isSafeInteger(frame.metrics[key]) && frame.metrics[key] >= 0)))) onProgress(frame);
        else throw new Error('invalid_chat_response');
      }
    }
    if (buffer.trim() || !decision) throw new Error('incomplete_chat_response');
    return decision;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export function chatFailureMessage(reason = '') {
  if (reason === 'generated_speech_daily_budget_exhausted') return 'Dagens budget för läppsynk är nådd. Nya röstsvar blir tillgängliga nästa dag.';
  if (reason === 'hidden') return 'Uppspelningen avbröts när du bytte flik.';
  if (reason === 'muted') return 'Slå på ljudet för att höra dealerns svar.';
  if (/stale|^stale:/.test(reason)) return 'Bordet eller profilen ändrades. Skicka frågan igen.';
  if (/busy/.test(reason)) return 'Rösttjänsten är upptagen. Försök igen strax.';
  if (/timeout/.test(reason)) return 'Svaret tog för lång tid. Försök igen.';
  if (/generated_speech/.test(reason)) return 'Rösten eller läppsynken kunde inte skapas. Försök igen.';
  return 'Svaret kunde inte slutföras. Försök igen.';
}

// Shared with the server preparation receipt. Enumerate application-owned
// codes only: never admit arbitrary provider messages by prefix or regex.
export const SPEECH_PREPARATION_FAILURE_CODES = Object.freeze([
  'chat_cancelled', 'stale_chat_session', 'stale_chat_memory', 'stale_round_revision',
  ...['dealer_invalid', 'dealer_unavailable', 'profiles_not_configured',
    'profile_invalid', 'profile_not_enabled', 'profile_changed',
    'reference_kind', 'reference_mismatch', 'reference_out_of_range', 'reference_changed',
    'voice_not_configured', 'voice_unavailable',
    'moving_not_configured', 'moving_sources_invalid', 'moving_reference_unavailable',
    'moving_schema_required', 'moving_project_changed', 'moving_media_unavailable',
    'moving_capacity_unverified', 'moving_budget_scope_mismatch',
    'moving_admission_timeout', 'moving_release_timeout', 'moving_drain_unknown', 'moving_endpoint_mismatch',
    'total_budget_exhausted', 'daily_budget_exhausted', 'budget_policy_missing',
    'lease_busy', 'stale_fence', 'recovery_required', 'recovery_only',
    'journal_unavailable', 'journal_invalid', 'worker_not_drained',
  ].map(code => `generated_speech_${code}`),
  ...['unavailable', 'response_invalid', 'limits_changed', 'workers_unknown',
    'active_workers_exceeded', 'worker_state_unknown', 'template_unverified',
  ].map(code => `moving_runpod_${code}`),
  'moving_worker_release_changed', 'moving_worker_release_unverified', 'moving_worker_release_mismatch',
]);

// Expose only stable application codes for DOM diagnostics, never an upstream
// exception, URL, utterance, ticket or arbitrary server response.
const diagnosticCodes = new Set([
  ...SPEECH_PREPARATION_FAILURE_CODES,
  'chat_failed', 'chat_cancelled', 'stale_chat_session', 'stale_chat_memory',
  'stale_round_revision', 'hidden', 'muted', 'speech_autoplay_blocked',
  ...['frame_unavailable', 'socket_closed', 'socket_failed', 'render_failed',
    'audio_failed', 'audio_paused', 'timeout', 'queue_full', 'unavailable',
    'rest_unavailable', 'rest_size', 'rest_hash_mismatch', 'decoder_unavailable',
    'pcm_hash_mismatch', 'rejected_chunk', 'unpaired_binary', 'missing_binary',
    'ticket_expired', 'sequence_incomplete', 'geometry_changed',
  ].map(code => `moving_speech_${code}`),
  ...['message', 'chunk', 'ready', 'source', 'sequence'].map(code => `invalid_moving_speech_${code}`),
  ...['busy', 'cancelled', 'failed', 'daily_budget_exhausted', 'not_configured',
    'request_already_attempted', 'request_conflict', 'timeout',
    ...['busy', 'cancelled', 'invalid_directory', 'ledger_invalid', 'not_configured',
      'start_timeout', 'stop_timeout', 'stopping', 'submission_uncertain', 'unavailable',
      'untracked_worker', 'worker_failed',
      ...['empty', 'invalid_json', 'invalid_status', 'job_mismatch', 'response_too_large',
        'unauthorized', 'forbidden', 'not_found', 'rate_limited', 'http_failed'].map(code => `provider_${code}`),
    ].map(code => `session_${code}`),
    ...['busy', 'cancelled', 'failed', 'invalid_directory', 'ledger_full', 'not_configured',
      'worker_unavailable'].map(code => `stream_${code}`),
  ].map(code => `generated_speech_${code}`),
]);
export const chatFailureCode = reason => diagnosticCodes.has(reason) ? reason : 'chat_failed';
