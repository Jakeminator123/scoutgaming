// Generated replies need one exact spoken/displayed text before preview, TTS
// and media hashing. Recorded lines never pass through this normalization.
export function normalizeGeneratedSpeechText(value) {
  // Reject other controls before trimming, including tabs at either edge.
  if (typeof value !== 'string' || /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value)) return null;
  return value.replace(/[ \r\n]+/g, whitespace => /[\r\n]/.test(whitespace) ? ' ' : whitespace).trim();
}
