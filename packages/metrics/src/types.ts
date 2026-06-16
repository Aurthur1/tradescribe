/**
 * TradeScribe metrics — type definitions.
 *
 * These are the inputs and outputs of the deterministic metrics engine.
 * The engine is PURE: no I/O, no AI, no Date.now(), no randomness. Given the
 * same input it always returns the same output. Every number rendered in the
 * dashboard comes from here.
 */

export type TradeSide = 'BUY' | 'SELL';

export type TradingSession = 'Sydney' | 'Tokyo' | 'London' | 'New York';

/**
 * A single closed trade, already normalized from MT4/MT5 (Segment 2).
 * Balance operations (deposits/withdrawals) must be excluded before this point.
 */
export interface MetricsTrade {
  id: string;
  symbol: string;
  side: TradeSide;
  /** ISO 8601 string or Date. UTC. */
  openTime: string | Date;
  /** ISO 8601 string or Date. UTC. */
  closeTime: string | Date;
  openPrice: number;
  closePrice: number;
  /** Lots. */
  volume: number;
  /** Broker profit field (gross, excludes commission/swap). */
  grossProfit: number;
  /** Usually <= 0. */
  commission: number;
  /** Swap / rollover. Can be + or -. */
  swap: number;
  /** Null/0 means the trader placed no stop loss on this trade. */
  stopLoss?: number | null;
  takeProfit?: number | null;
  /**
   * Planned loss in ACCOUNT CURRENCY if the stop had been hit. Computed during
   * normalization (Segment 2) where symbol contract specs are known. When
   * present and > 0, rMultiple is derived from it. Null when no stop loss.
   */
  riskAmount?: number | null;
  /** Optional precomputed R multiple. Takes precedence over riskAmount. */
  rMultiple?: number | null;
  /** Optional precomputed duration. If absent, computed from close - open. */
  durationSec?: number | null;
}

/** Equity/balance point in time, from MetaApi (Segment 2), UTC. */
export interface EquitySnapshot {
  ts: string | Date;
  equity: number;
  balance: number;
}

export interface SessionBreakdown {
  session: TradingSession;
  trades: number;
  netPnl: number;
  winRate: number;
}

export interface SymbolBreakdown {
  symbol: string;
  trades: number;
  netPnl: number;
  winRate: number;
}

export interface RMultipleHistogramBin {
  bin: string;
  count: number;
  netPnl: number;
}

export type StreakType = 'win' | 'loss' | 'breakeven' | null;

export interface StreakSummary {
  type: StreakType;
  count: number;
}

export interface DayOfWeekBreakdown {
  weekday: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  trades: number;
  netPnl: number;
  winRate: number;
}

export type WeekdayBreakdown = DayOfWeekBreakdown;

export interface DailyPoint {
  /** YYYY-MM-DD in the requested time zone. */
  date: string;
  netPnl: number;
  tradeCount: number;
  cumulativePnl: number;
}

export interface Drawdown {
  /** Largest peak-to-trough drop in account currency. >= 0. */
  abs: number;
  /** Same as a fraction of the running peak. 0..1. */
  pct: number;
}

/**
 * Why a profit factor has no finite value.
 * - 'no_trades': there were no trades at all.
 * - 'no_losses': there were winning trades but zero losing trades (effectively infinite).
 * - null: profit factor is a normal finite number.
 */
export type ProfitFactorReason = 'no_trades' | 'no_losses' | null;

export interface CoreMetrics {
  netPnl: number;
  grossWin: number;
  grossLoss: number; // <= 0
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number; // 0..1
  avgWin: number; // 0 when no winners
  avgLoss: number; // <= 0, 0 when no losers
  /** Finite number, or null when undefined (see profitFactorReason). */
  profitFactor: number | null;
  profitFactorReason: ProfitFactorReason;
  expectancyCurrency: number;
  /** R-based stats are null when no trade in the set had a stop loss. */
  avgWinR: number | null;
  avgLossR: number | null;
  expectancyR: number | null;
  avgHoldSeconds: number | null;
  largestWin: number;
  largestLoss: number;
  currentStreak: StreakSummary;
  longestWinStreak: number;
  longestLossStreak: number;
}

export interface DeltaValue {
  current: number;
  previous: number;
  /** current - previous (absolute). */
  absolute: number;
  /** Relative change vs previous as a fraction (0.082 = +8.2%). null when previous is 0. */
  percent: number | null;
}

export interface MetricsDeltas {
  netPnl: DeltaValue;
  winRate: DeltaValue;
  profitFactor: DeltaValue;
  totalTrades: DeltaValue;
}

export interface MetricsResult extends CoreMetrics {
  drawdown: Drawdown;
  dailySeries: DailyPoint[];
  bySymbol: SymbolBreakdown[];
  bySession: SessionBreakdown[];
  byDayOfWeek: DayOfWeekBreakdown[];
  rMultipleHistogram: RMultipleHistogramBin[];
  bestDay: { date: string; netPnl: number } | null;
  worstDay: { date: string; netPnl: number } | null;
  /** Present only when previousTrades were supplied to computeMetrics. */
  deltas: MetricsDeltas | null;
}

export interface ComputeMetricsInput {
  trades: MetricsTrade[];
  /** Same-length-prior-period trades, to compute the "vs previous" deltas. */
  previousTrades?: MetricsTrade[];
  /** Real equity points; preferred source for drawdown. */
  equitySnapshots?: EquitySnapshot[];
  /** Used to build a cumulative-PnL curve when no equitySnapshots are given. */
  startingBalance?: number;
  /** IANA time zone for daily bucketing (calendar/chart). Default 'UTC'. */
  timeZone?: string;
}
