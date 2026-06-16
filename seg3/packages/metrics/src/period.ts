import type {
  ComputeMetricsInput,
  CoreMetrics,
  DeltaValue,
  MetricsDeltas,
  MetricsResult,
} from './types.js';
import { computeCoreMetrics } from './calculations.js';
import { computeDrawdown } from './drawdown.js';
import { computeDailySeries, computeBySymbol, computeBySession } from './series.js';

function delta(current: number, previous: number): DeltaValue {
  const absolute = current - previous;
  const percent = previous === 0 ? null : absolute / Math.abs(previous);
  return { current, previous, absolute, percent };
}

/** "vs previous period" deltas for the KPI cards. */
export function computeDeltas(current: CoreMetrics, previous: CoreMetrics): MetricsDeltas {
  return {
    netPnl: delta(current.netPnl, previous.netPnl),
    winRate: delta(current.winRate, previous.winRate),
    profitFactor: delta(current.profitFactor ?? 0, previous.profitFactor ?? 0),
    totalTrades: delta(current.totalTrades, previous.totalTrades),
  };
}

/**
 * Top-level entry point. Computes everything the dashboard needs in one pass.
 * Pure: same input -> same output.
 */
export function computeMetrics(input: ComputeMetricsInput): MetricsResult {
  const { trades, previousTrades, equitySnapshots, startingBalance = 0, timeZone = 'UTC' } = input;

  const core = computeCoreMetrics(trades);
  const drawdown = computeDrawdown(trades, equitySnapshots, startingBalance);
  const dailySeries = computeDailySeries(trades, timeZone);
  const bySymbol = computeBySymbol(trades);
  const bySession = computeBySession(trades);

  const deltas = previousTrades ? computeDeltas(core, computeCoreMetrics(previousTrades)) : null;

  return { ...core, drawdown, dailySeries, bySymbol, bySession, deltas };
}
