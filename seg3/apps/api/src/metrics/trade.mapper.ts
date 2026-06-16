import type { MetricsTrade } from '@tradescribe/metrics';
import { sessionOf } from '@tradescribe/metrics';

/**
 * Shape of a Trade row from Prisma (Segment 2 normalization). Adjust field names
 * to your schema if they differ. `session` is optional: if your Trade model
 * persists it (recommended), it is used directly; otherwise it is derived.
 */
export interface TradeRow {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  openTime: Date;
  closeTime: Date;
  openPrice: number;
  closePrice: number;
  volume: number;
  grossProfit: number;
  commission: number;
  swap: number;
  stopLoss: number | null;
  takeProfit: number | null;
  riskAmount: number | null;
  rMultiple: number | null;
  durationSec: number | null;
  session?: 'Sydney' | 'Tokyo' | 'London' | 'New York' | null;
}

export function toMetricsTrade(row: TradeRow): MetricsTrade {
  return {
    id: row.id,
    symbol: row.symbol,
    side: row.side,
    openTime: row.openTime,
    closeTime: row.closeTime,
    openPrice: row.openPrice,
    closePrice: row.closePrice,
    volume: row.volume,
    grossProfit: row.grossProfit,
    commission: row.commission,
    swap: row.swap,
    stopLoss: row.stopLoss,
    takeProfit: row.takeProfit,
    riskAmount: row.riskAmount,
    rMultiple: row.rMultiple,
    durationSec: row.durationSec,
  };
}

/** Resolve a row's session, preferring a persisted column, else deriving it. */
export function rowSession(row: TradeRow) {
  return row.session ?? sessionOf(toMetricsTrade(row));
}
