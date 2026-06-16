import type {
  DailyPoint,
  MetricsTrade,
  RMultipleHistogramBin,
  SessionBreakdown,
  SymbolBreakdown,
  TradingSession,
  DayOfWeekBreakdown,
} from './types.js';
import { netProfit, isWin, resolveRMultiple, toDate } from './util.js';
import { sessionOf } from './sessions.js';

const WEEKDAYS: DayOfWeekBreakdown['weekday'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_R_BINS = [-Infinity, -2, -1, 0, 1, 2, 3, Infinity];

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

function rLabel(lower: number, upper: number): string {
  if (lower === -Infinity) return `< ${upper}R`;
  if (upper === Infinity) return `> ${lower}R`;
  return `${lower}R to ${upper}R`;
}

/**
 * R-multiple distribution. Bins are lower-inclusive and upper-exclusive, except
 * the final Infinity bin, so exactly 1R falls in "1R to 2R".
 */
export function rMultipleHistogram(
  trades: MetricsTrade[],
  binEdges: number[] = DEFAULT_R_BINS
): RMultipleHistogramBin[] {
  const edges = [...binEdges];
  if (edges.length < 2) return [];

  const bins = edges.slice(0, -1).map((lower, index) => ({
    lower,
    upper: edges[index + 1]!,
    bin: rLabel(lower, edges[index + 1]!),
    count: 0,
    netPnl: 0,
  }));

  for (const trade of trades) {
    const r = resolveRMultiple(trade);
    if (r === null || Number.isNaN(r)) continue;

    const bin = bins.find(({ lower, upper }, index) => {
      const isLast = index === bins.length - 1;
      return r >= lower && (isLast ? r <= upper : r < upper);
    });

    if (!bin) continue;
    bin.count += 1;
    bin.netPnl += netProfit(trade);
  }

  return bins.map(({ bin, count, netPnl }) => ({ bin, count, netPnl }));
}

function weekdayInZone(when: string | Date, timeZone: string): DayOfWeekBreakdown['weekday'] {
  const label = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(toDate(when));
  return WEEKDAYS.includes(label as DayOfWeekBreakdown['weekday'])
    ? (label as DayOfWeekBreakdown['weekday'])
    : WEEKDAYS[(toDate(when).getUTCDay() + 6) % 7]!;
}

export function computeByDayOfWeek(trades: MetricsTrade[], timeZone = 'UTC'): DayOfWeekBreakdown[] {
  const map = new Map<DayOfWeekBreakdown['weekday'], { trades: number; wins: number; netPnl: number }>();
  for (const weekday of WEEKDAYS) {
    map.set(weekday, { trades: 0, wins: 0, netPnl: 0 });
  }

  for (const trade of trades) {
    const weekday = weekdayInZone(trade.closeTime, timeZone);
    const current = map.get(weekday)!;
    current.trades += 1;
    current.wins += isWin(trade) ? 1 : 0;
    current.netPnl += netProfit(trade);
  }

  return WEEKDAYS.map((weekday) => {
    const value = map.get(weekday)!;
    return {
      weekday,
      trades: value.trades,
      netPnl: value.netPnl,
      winRate: value.trades ? value.wins / value.trades : 0,
    };
  });
}

export const computeByWeekday = computeByDayOfWeek;
