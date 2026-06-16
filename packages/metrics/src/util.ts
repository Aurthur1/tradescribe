import type { MetricsTrade } from './types.js';
import { BREAKEVEN_EPSILON } from './constants.js';

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Net P&L of a trade in account currency: gross + commission + swap. */
export function netProfit(t: MetricsTrade): number {
  return t.grossProfit + t.commission + t.swap;
}

export function isWin(t: MetricsTrade): boolean {
  return netProfit(t) > BREAKEVEN_EPSILON;
}

export function isLoss(t: MetricsTrade): boolean {
  return netProfit(t) < -BREAKEVEN_EPSILON;
}

export function isBreakeven(t: MetricsTrade): boolean {
  return Math.abs(netProfit(t)) <= BREAKEVEN_EPSILON;
}

/** Resolve a trade's R multiple. Precomputed value wins; else derive from riskAmount; else null. */
export function resolveRMultiple(t: MetricsTrade): number | null {
  if (t.rMultiple !== undefined && t.rMultiple !== null) return t.rMultiple;
  if (t.riskAmount !== undefined && t.riskAmount !== null && t.riskAmount > 0) {
    return netProfit(t) / t.riskAmount;
  }
  return null;
}

/** Duration in seconds. Precomputed value wins; else close - open. Never negative. */
export function durationSeconds(t: MetricsTrade): number {
  if (t.durationSec !== undefined && t.durationSec !== null) return Math.max(0, t.durationSec);
  const ms = toDate(t.closeTime).getTime() - toDate(t.openTime).getTime();
  return Math.max(0, Math.round(ms / 1000));
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Round to a fixed number of decimals to avoid floating-point noise in outputs. */
export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}
