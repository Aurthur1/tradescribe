export function formatCurrency(value: number, currency = 'USD'): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${sign}${formatted}`;
}

export function formatPercent(fraction: number, decimals = 0): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** A signed percent for deltas, e.g. 0.082 -> "+8.2%". null -> "—". */
export function formatDeltaPercent(fraction: number | null, decimals = 1): string {
  if (fraction === null || Number.isNaN(fraction)) return '—';
  const sign = fraction > 0 ? '+' : '';
  return `${sign}${(fraction * 100).toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(value);
}

/** Profit factor display, handling the undefined cases from the engine. */
export function formatProfitFactor(value: number | null, reason: string | null): string {
  if (value !== null) return value.toFixed(2);
  if (reason === 'no_losses') return '∞';
  return '—';
}
