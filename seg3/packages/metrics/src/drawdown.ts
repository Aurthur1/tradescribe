import type { Drawdown, EquitySnapshot, MetricsTrade } from './types.js';
import { netProfit, toDate } from './util.js';

/**
 * Max peak-to-trough drawdown over an ordered equity curve.
 * Returns absolute drop (account currency) and as a fraction of the running peak.
 */
export function maxDrawdown(equityCurve: number[]): Drawdown {
  if (equityCurve.length === 0) return { abs: 0, pct: 0 };
  let peak = equityCurve[0];
  let maxAbs = 0;
  let maxPct = 0;
  for (const v of equityCurve) {
    if (v > peak) peak = v;
    const dd = peak - v;
    if (dd > maxAbs) maxAbs = dd;
    if (peak > 0) {
      const pct = dd / peak;
      if (pct > maxPct) maxPct = pct;
    }
  }
  return { abs: maxAbs, pct: maxPct };
}

/**
 * Build an equity curve. Prefers real equity snapshots; otherwise reconstructs a
 * cumulative-PnL curve from trade closes (an approximation: it cannot see intra-trade
 * equity, only equity at each close).
 */
export function buildEquityCurve(
  trades: MetricsTrade[],
  equitySnapshots?: EquitySnapshot[],
  startingBalance = 0,
): number[] {
  if (equitySnapshots && equitySnapshots.length > 0) {
    return [...equitySnapshots]
      .sort((a, b) => toDate(a.ts).getTime() - toDate(b.ts).getTime())
      .map((s) => s.equity);
  }
  const sorted = [...trades].sort(
    (a, b) => toDate(a.closeTime).getTime() - toDate(b.closeTime).getTime(),
  );
  const curve: number[] = [startingBalance];
  let running = startingBalance;
  for (const t of sorted) {
    running += netProfit(t);
    curve.push(running);
  }
  return curve;
}

export function computeDrawdown(
  trades: MetricsTrade[],
  equitySnapshots?: EquitySnapshot[],
  startingBalance = 0,
): Drawdown {
  return maxDrawdown(buildEquityCurve(trades, equitySnapshots, startingBalance));
}
