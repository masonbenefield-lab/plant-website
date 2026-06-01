// US sales tax rates by state (where the platform has nexus).
// Add new states here as economic nexus thresholds are reached.
export const STATE_TAX_RATES: Record<string, number> = {
  TX: 0.0825, // 6.25% state + ~2% avg local
};

export function calcTaxCents(itemAmountCents: number, state: string): number {
  const rate = STATE_TAX_RATES[state.trim().toUpperCase()] ?? 0;
  return Math.round(itemAmountCents * rate);
}
