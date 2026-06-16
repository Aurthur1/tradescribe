import type { EquitySnapshot, MetricsTrade, TradeSide } from "@tradescribe/metrics";

export type LeakSeverity = "info" | "warning" | "critical";
export type LeakStatus = "active" | "acknowledged" | "dismissed";

export type LeakType =
  | "revenge_trade"
  | "overtrading"
  | "missing_stop_loss"
  | "stop_widened"
  | "risk_inconsistency"
  | "asymmetric_win_loss"
  | "correlated_cluster"
  | "excessive_single_trade_risk";

export interface LeakFlag {
  type: LeakType;
  severity: LeakSeverity;
  tradeIds: string[];
  periodStart?: string;
  periodEnd?: string;
  evidence: Record<string, number | string>;
}

export interface StopModification {
  tradeId: string;
  original: number;
  final: number;
  openPrice: number;
  side: TradeSide;
}

export interface SignalsConfig {
  asymmetryRatio: number;
  correlationGroups: Record<string, string[]>;
  missingStopCriticalLossPct: number;
  minTradesForCv: number;
  overtradeRatio: number;
  overtradeStdMultiplier: number;
  revengeSizeMultiplier: number;
  revengeWindowMinutes: number;
  riskCvThreshold: number;
  singleTradeRiskPct: number;
  timeZone: string;
  trailingBaselineDays: number;
}

export interface DetectLeaksInput {
  accountEquitySnapshots?: EquitySnapshot[];
  baselineTrades?: MetricsTrade[];
  startingBalance?: number;
  stopModifications?: StopModification[];
  trades: MetricsTrade[];
  config?: Partial<SignalsConfig>;
}

export interface PropFirmRules {
  alertThresholdPct: number;
  consistencyMaxDailyProfitPct?: number;
  maxDailyLossMode: "balance" | "equity";
  maxDailyLossPct?: number;
  maxDrawdownMode: "static" | "trailing";
  maxDrawdownPct?: number;
  profitTargetPct?: number;
  startingBalance: number;
}

export type GuardrailLimitStatus = "ok" | "warning" | "breached";

export interface GuardrailStatus {
  dailyLoss?: { usedPct: number; limitPct: number; status: GuardrailLimitStatus; remainingAmount: number };
  drawdown?: {
    usedPct: number;
    limitPct: number;
    status: GuardrailLimitStatus;
    remainingAmount: number;
    mode: "static" | "trailing";
  };
  profitTarget?: { progressPct: number; targetPct: number; status: "in_progress" | "reached" };
  consistency?: { worstDayPct: number; limitPct: number; status: GuardrailLimitStatus };
  overallStatus: GuardrailLimitStatus;
}
