// Reject sub-cent deposits; normalize harmless binary floating-point noise once,
// so wallet and ledger always receive the same whole-cent amount.
export function depositAmount(value, { min = 0.01, max = 100_000 } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return null;
  const pennies = Math.round(value * 100);
  if (!Number.isSafeInteger(pennies) || Math.abs(value * 100 - pennies) > 0.000001) return null;
  return pennies / 100;
}
