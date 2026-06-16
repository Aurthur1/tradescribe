import type {
  DailyPoint,
  MetricsTrade,
  SessionBreakdown,
  SymbolBreakdown,
  TradingSession,
} from './types.js';
import { netProfit, isWin, toDate } from './util.js';
import { sessionOf } from './sessions.js';

/** YYYY-MM-DD for a UTC instant, rendered in the given IANA time zone. Dependency-free via Intl. */
export function dateKeyInZone(when: string | Date, timeZone: string): string {
  const d = toDate(when);
  // en-CA yields YYYY-MM-DD; timeZone shifts the wall-clock date correctly.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Daily P&L series for the chart + calendar, bucketed by the trade CLOSE date in
 * the requested time zone, sorted ascending, with a running cumulative total.
 */
export function computeDailySeries(trades: MetricsTrade[], timeZone = 'UTC'): DailyPoint[] {
  const byDay = new Map<string, { netPnl: number; tradeCount: number }>();
  for (const t of trades) {
    const key = dateKeyInZone(t.closeTime, timeZone);
    const cur = byDay.get(key) ?? { netPnl: 0, tradeCount: 0 };
    cur.netPnl += netProfit(t);
    cur.tradeCount += 1;
    byDay.set(key, cur);
  }
  const days = [...byDay.keys()].sort();
  let cumulative = 0;
  return days.map((date) => {
    const { netPnl, tradeCount } = byDay.get(date)!;
    cumulative += netPnl;
    return { date, netPnl, tradeCount, cumulativePnl: cumulative };
  });
}

export function computeBySymbol(trades: MetricsTrade[]): SymbolBreakdown[] {
  const map = new Map<string, { trades: number; wins: number; netPnl: number }>();
  for (const t of trades) {
    const cur = map.get(t.symbol) ?? { trades: 0, wins: 0, netPnl: 0 };
    cur.trades += 1;
    cur.wins += isWin(t) ? 1 : 0;
    cur.netPnl += netProfit(t);
    map.set(t.symbol, cur);
  }
  return [...map.entries()]
    .map(([symbol, v]) => ({
      symbol,
      trades: v.trades,
      netPnl: v.netPnl,
      winRate: v.trades ? v.wins / v.trades : 0,
    }))
    .sort((a, b) => b.netPnl - a.netPnl);
}

export function computeBySession(trades: MetricsTrade[]): SessionBreakdown[] {
  const order: TradingSession[] = ['Sydney', 'Tokyo', 'London', 'New York'];
  const map = new Map<TradingSession, { trades: number; wins: number; netPnl: number }>();
  for (const t of trades) {
    const s = sessionOf(t);
    const cur = map.get(s) ?? { trades: 0, wins: 0, netPnl: 0 };
    cur.trades += 1;
    cur.wins += isWin(t) ? 1 : 0;
    cur.netPnl += netProfit(t);
    map.set(s, cur);
  }
  return order
    .filter((s) => map.has(s))
    .map((s) => {
      const v = map.get(s)!;
      return { session: s, trades: v.trades, netPnl: v.netPnl, winRate: v.trades ? v.wins / v.trades : 0 };
    });
}
