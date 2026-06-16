import { describe, it, expect } from 'vitest';
import {
  computeMetrics,
  computeCoreMetrics,
  classifySession,
  computeDailySeries,
  maxDrawdown,
  type MetricsTrade,
} from '../src/index.js';

/** Helper to build a trade with sensible defaults; net = grossProfit (commission/swap 0). */
function trade(p: Partial<MetricsTrade> & { id: string; grossProfit: number }): MetricsTrade {
  return {
    symbol: 'EURUSD',
    side: 'BUY',
    openTime: '2025-04-07T08:00:00Z',
    closeTime: '2025-04-07T09:00:00Z',
    openPrice: 1.1,
    closePrice: 1.1,
    volume: 1,
    commission: 0,
    swap: 0,
    stopLoss: null,
    durationSec: 3600,
    ...p,
  };
}

const mixed: MetricsTrade[] = [
  trade({ id: 'T1', grossProfit: 100, riskAmount: 50, openTime: '2025-04-07T08:00:00Z', closeTime: '2025-04-07T09:00:00Z', durationSec: 3600 }),
  trade({ id: 'T2', grossProfit: -50, riskAmount: 50, openTime: '2025-04-07T02:00:00Z', closeTime: '2025-04-07T03:00:00Z', durationSec: 1800 }),
  trade({ id: 'T3', grossProfit: 200, riskAmount: 100, symbol: 'GBPUSD', openTime: '2025-04-08T13:00:00Z', closeTime: '2025-04-08T14:00:00Z', durationSec: 7200 }),
  trade({ id: 'T4', grossProfit: -50, riskAmount: 50, openTime: '2025-04-08T23:00:00Z', closeTime: '2025-04-08T23:30:00Z', durationSec: 1800 }),
];

describe('core metrics — mixed set', () => {
  const m = computeCoreMetrics(mixed);
  it('counts and P&L', () => {
    expect(m.totalTrades).toBe(4);
    expect(m.winningTrades).toBe(2);
    expect(m.losingTrades).toBe(2);
    expect(m.netPnl).toBe(200);
    expect(m.grossWin).toBe(300);
    expect(m.grossLoss).toBe(-100);
  });
  it('rates and averages', () => {
    expect(m.winRate).toBeCloseTo(0.5, 10);
    expect(m.avgWin).toBe(150);
    expect(m.avgLoss).toBe(-50);
    expect(m.profitFactor).toBe(3);
    expect(m.profitFactorReason).toBeNull();
    expect(m.expectancyCurrency).toBeCloseTo(50, 10);
  });
  it('R-multiple stats', () => {
    expect(m.avgWinR).toBeCloseTo(2, 10);
    expect(m.avgLossR).toBeCloseTo(-1, 10);
    expect(m.expectancyR).toBeCloseTo(0.5, 10);
  });
  it('average hold', () => {
    expect(m.avgHoldSeconds).toBe(3600);
  });
});

describe('edge cases', () => {
  it('empty set', () => {
    const m = computeCoreMetrics([]);
    expect(m.totalTrades).toBe(0);
    expect(m.netPnl).toBe(0);
    expect(m.winRate).toBe(0);
    expect(m.profitFactor).toBeNull();
    expect(m.profitFactorReason).toBe('no_trades');
    expect(m.expectancyR).toBeNull();
  });
  it('all wins -> profit factor undefined (no_losses)', () => {
    const m = computeCoreMetrics([
      trade({ id: 'W1', grossProfit: 100 }),
      trade({ id: 'W2', grossProfit: 50 }),
    ]);
    expect(m.profitFactor).toBeNull();
    expect(m.profitFactorReason).toBe('no_losses');
    expect(m.winRate).toBe(1);
    expect(m.avgLoss).toBe(0);
    expect(m.expectancyCurrency).toBeCloseTo(75, 10);
  });
  it('all losses -> profit factor 0', () => {
    const m = computeCoreMetrics([
      trade({ id: 'L1', grossProfit: -100 }),
      trade({ id: 'L2', grossProfit: -50 }),
    ]);
    expect(m.profitFactor).toBe(0);
    expect(m.profitFactorReason).toBeNull();
    expect(m.winRate).toBe(0);
    expect(m.expectancyCurrency).toBeCloseTo(-75, 10);
  });
  it('no stop loss -> R stats null', () => {
    const m = computeCoreMetrics([
      trade({ id: 'N1', grossProfit: 100 }),
      trade({ id: 'N2', grossProfit: -40 }),
    ]);
    expect(m.avgWinR).toBeNull();
    expect(m.avgLossR).toBeNull();
    expect(m.expectancyR).toBeNull();
  });
  it('commission and swap fold into net', () => {
    const m = computeCoreMetrics([
      trade({ id: 'C1', grossProfit: 100, commission: -7, swap: -3 }),
    ]);
    expect(m.netPnl).toBe(90);
    expect(m.winningTrades).toBe(1);
  });
});

describe('session classification (UTC-anchored)', () => {
  const at = (h: number) => `2025-04-07T${String(h).padStart(2, '0')}:00:00Z`;
  it('classifies representative hours', () => {
    expect(classifySession(at(8))).toBe('London');
    expect(classifySession(at(13))).toBe('London'); // London/NY overlap -> London by priority
    expect(classifySession(at(18))).toBe('New York');
    expect(classifySession(at(2))).toBe('Tokyo');
    expect(classifySession(at(5))).toBe('Tokyo');
    expect(classifySession(at(23))).toBe('Sydney');
    expect(classifySession(at(0))).toBe('Tokyo'); // Tokyo/Sydney overlap -> Tokyo by priority
  });
});

describe('daily series and time zones', () => {
  it('buckets by close date with cumulative total (UTC)', () => {
    const series = computeDailySeries(mixed, 'UTC');
    expect(series).toEqual([
      { date: '2025-04-07', netPnl: 50, tradeCount: 2, cumulativePnl: 50 },
      { date: '2025-04-08', netPnl: 150, tradeCount: 2, cumulativePnl: 200 },
    ]);
  });
  it('respects the requested time zone when bucketing', () => {
    const t = [trade({ id: 'Z1', grossProfit: 10, closeTime: '2025-04-08T01:00:00Z' })];
    expect(computeDailySeries(t, 'UTC')[0].date).toBe('2025-04-08');
    expect(computeDailySeries(t, 'America/New_York')[0].date).toBe('2025-04-07');
  });
});

describe('drawdown', () => {
  it('finds max peak-to-trough', () => {
    // curve 1000 -> 950 -> 1050 -> 1250 -> 1200
    const dd = maxDrawdown([1000, 950, 1050, 1250, 1200]);
    expect(dd.abs).toBe(50);
    // Two 50-unit dips occur: 1000->950 (5%) and 1250->1200 (4%). Max % is the larger, 5%.
    expect(dd.pct).toBeCloseTo(50 / 1000, 10);
  });
  it('reconstructs from trades + starting balance', () => {
    const full = computeMetrics({ trades: mixed, startingBalance: 1000 });
    expect(full.drawdown.abs).toBe(50);
    expect(full.drawdown.pct).toBeCloseTo(0.05, 10);
  });
});

describe('breakdowns and deltas', () => {
  const full = computeMetrics({
    trades: mixed,
    previousTrades: [trade({ id: 'P1', grossProfit: 100 }), trade({ id: 'P2', grossProfit: -40 })],
    startingBalance: 1000,
  });
  it('by symbol', () => {
    const gbp = full.bySymbol.find((s) => s.symbol === 'GBPUSD')!;
    const eur = full.bySymbol.find((s) => s.symbol === 'EURUSD')!;
    expect(gbp.netPnl).toBe(200);
    expect(eur.netPnl).toBe(0); // 100 - 50 - 50
    expect(eur.trades).toBe(3);
  });
  it('by session', () => {
    const london = full.bySession.find((s) => s.session === 'London')!;
    expect(london.trades).toBe(2);
    expect(london.netPnl).toBe(300);
    expect(london.winRate).toBe(1);
  });
  it('vs previous period deltas', () => {
    expect(full.deltas).not.toBeNull();
    expect(full.deltas!.netPnl.absolute).toBe(140); // 200 - 60
    expect(full.deltas!.totalTrades.current).toBe(4);
    expect(full.deltas!.totalTrades.previous).toBe(2);
    expect(full.deltas!.winRate.current).toBeCloseTo(0.5, 10);
    expect(full.deltas!.winRate.previous).toBeCloseTo(0.5, 10); // 1 win of 2
  });
});
