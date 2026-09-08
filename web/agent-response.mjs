// The upstream agent may return a usage/auth failure as successful SSE text.
// These are transport diagnostics, never words for the dealer to perform.
export function isAgentFailure(text) {
  return /(?:you[’']ve hit your (?:session|usage) limit|rate_limit_error|authentication_error|invalid api key|credit balance is too low|exceeded your current quota)/i.test(text);
}
