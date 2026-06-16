import type { MetricsTrade, TradingSession } from './types.js';
import { SESSION_RANGES_UTC, SESSION_PRIORITY } from './constants.js';
import { toDate } from './util.js';

/** True if `hour` falls in [start, end), supporting ranges that wrap past midnight. */
export function hourInRange(hour: number, start: number, end: number): boolean {
  if (start <= end) return hour >= start && hour < end;
  // wraps midnight, e.g. Sydney 21..6
  return hour >= start || hour < end;
}

/**
 * Classify a trade into a single trading session by its OPEN time, using UTC
 * market hours (sessions are UTC-anchored, independent of the user's time zone).
 * Overlaps resolved by SESSION_PRIORITY.
 */
export function classifySession(openTime: string | Date): TradingSession {
  const hour = toDate(openTime).getUTCHours();
  for (const session of SESSION_PRIORITY) {
    const { start, end } = SESSION_RANGES_UTC[session];
    if (hourInRange(hour, start, end)) return session;
  }
  // Every hour is covered by at least one session, but keep a deterministic fallback.
  return 'New York';
}

export function sessionOf(trade: MetricsTrade): TradingSession {
  return classifySession(trade.openTime);
}
