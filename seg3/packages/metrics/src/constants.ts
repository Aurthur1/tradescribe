import type { TradingSession } from './types.js';

/**
 * Forex trading sessions in UTC hours [startHour, endHour).
 * A range may wrap past midnight (Sydney). These are intentionally tunable.
 */
export const SESSION_RANGES_UTC: Record<TradingSession, { start: number; end: number }> = {
  Sydney: { start: 21, end: 6 },
  Tokyo: { start: 0, end: 9 },
  London: { start: 7, end: 16 },
  'New York': { start: 12, end: 21 },
};

/**
 * When sessions overlap (they do: London/NY 12-16, Tokyo/London 7-9, etc.),
 * the earliest match in this priority order wins. Most-liquid first.
 */
export const SESSION_PRIORITY: TradingSession[] = ['London', 'New York', 'Tokyo', 'Sydney'];

/** Breakeven band: |netProfit| <= this is treated as a scratch trade, not win/loss. */
export const BREAKEVEN_EPSILON = 1e-9;
