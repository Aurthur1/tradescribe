export function formatCurrency(value: number, currency = "USD") {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const formatted = new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(Math.abs(value));

  return `${sign}${formatted}`;
}

export function formatPercent(value: number, decimals = 0) {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatDeltaPercent(value: number | null, decimals = 1) {
  if (value === null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals = 0) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(value);
}

export function formatProfitFactor(value: number | null, reason: "no_trades" | "no_losses" | null) {
  if (value !== null) return value.toFixed(2);
  if (reason === "no_losses") return "∞";
  return "—";
}
