import {
  computeCoreMetrics,
  dateKeyInZone,
  netProfit,
  toDate,
  type EquitySnapshot,
  type MetricsTrade
} from "@tradescribe/metrics";
import { mergeSignalsConfig } from "./signals.config.js";
import type { DetectLeaksInput, LeakFlag, SignalsConfig, StopModification } from "./types.js";

const MINUTE_MS = 60_000;

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function stdDev(values: number[]) {
  if (!values.length) return 0;
  const avg = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
}

function sortTrades(trades: MetricsTrade[]) {
  return [...trades].sort((a, b) => toDate(a.openTime).getTime() - toDate(b.openTime).getTime());
}

function equityAtOrBefore(snapshots: EquitySnapshot[] | undefined, when: string | Date, fallback?: number): number | undefined {
  if (!snapshots?.length) return fallback;
  const target = toDate(when).getTime();
  const sorted = [...snapshots].sort((a, b) => toDate(a.ts).getTime() - toDate(b.ts).getTime());
  let value: number | undefined = fallback;
  for (const snapshot of sorted) {
    if (toDate(snapshot.ts).getTime() > target) break;
    value = snapshot.equity;
  }
  return value;
}

export function detectRevengeTrade(trades: MetricsTrade[], configInput?: Partial<SignalsConfig>): LeakFlag[] {
  const config = mergeSignalsConfig(configInput);
  const sorted = sortTrades(trades);
  const flags: LeakFlag[] = [];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const loss = sorted[index];
    const next = sorted[index + 1];
    if (!loss || !next || netProfit(loss) >= 0) continue;
    const minutesAfter = (toDate(next.openTime).getTime() - toDate(loss.closeTime).getTime()) / MINUTE_MS;
    if (minutesAfter < 0 || minutesAfter > config.revengeWindowMinutes) continue;
    const sizeMultiplier = next.volume / loss.volume;
    if (sizeMultiplier < config.revengeSizeMultiplier) continue;

    flags.push({
      evidence: {
        lossTradeId: loss.id,
        lossVolume: loss.volume,
        minutesAfter: round(minutesAfter, 2),
        revengeTradeId: next.id,
        revengeVolume: next.volume,
        sizeMultiplier: round(sizeMultiplier, 4)
      },
      severity: sizeMultiplier >= 2 ? "critical" : "warning",
      tradeIds: [loss.id, next.id],
      type: "revenge_trade"
    });
  }

  return flags;
}

export function detectOvertrading(
  trades: MetricsTrade[],
  baselineTrades: MetricsTrade[] = [],
  revengeFlags: LeakFlag[] = [],
  configInput?: Partial<SignalsConfig>
): LeakFlag[] {
  const config = mergeSignalsConfig(configInput);
  const byDay = groupByCloseDay(trades, config.timeZone);
  const baselineByDay = groupByCloseDay(baselineTrades, config.timeZone);
  const baselineCounts = [...baselineByDay.values()].map((items) => items.length).slice(-config.trailingBaselineDays);
  const fallbackCounts = [...byDay.values()].map((items) => items.length);
  const counts = baselineCounts.length >= 5 ? baselineCounts : fallbackCounts;
  const baselineMean = mean(counts);
  const baselineStdDev = stdDev(counts);
  const revengeTradeIds = new Set(revengeFlags.flatMap((flag) => flag.tradeIds));
  const flags: LeakFlag[] = [];

  for (const [date, dayTrades] of byDay.entries()) {
    const dayCount = dayTrades.length;
    const threshold = baselineStdDev > 0 ? baselineMean + config.overtradeStdMultiplier * baselineStdDev : baselineMean * config.overtradeRatio;
    if (dayCount <= threshold) continue;

    const hasRevenge = dayTrades.some((trade) => revengeTradeIds.has(trade.id));
    flags.push({
      evidence: {
        baselineMean: round(baselineMean, 2),
        baselineStdDev: round(baselineStdDev, 2),
        date,
        dayCount,
        threshold: round(threshold, 2)
      },
      periodEnd: date,
      periodStart: date,
      severity: hasRevenge ? "critical" : "warning",
      tradeIds: dayTrades.map((trade) => trade.id),
      type: "overtrading"
    });
  }

  return flags;
}

export function detectMissingStopLoss(
  trades: MetricsTrade[],
  snapshots?: EquitySnapshot[],
  configInput?: Partial<SignalsConfig>,
  startingBalance?: number
): LeakFlag[] {
  const config = mergeSignalsConfig(configInput);
  return trades
    .filter((trade) => trade.stopLoss === null || trade.stopLoss === undefined || trade.stopLoss === 0)
    .map((trade) => {
      const equity = equityAtOrBefore(snapshots, trade.openTime, startingBalance);
      // If equity is not available, stay deterministic and classify missing stops as warning only.
      const critical = equity !== undefined && Math.abs(netProfit(trade)) > config.missingStopCriticalLossPct * equity;
      return {
        evidence: {
          netProfit: round(netProfit(trade), 2),
          symbol: trade.symbol,
          tradeId: trade.id,
          volume: trade.volume
        },
        severity: critical ? "critical" : ("warning" as const),
        tradeIds: [trade.id],
        type: "missing_stop_loss" as const
      };
    });
}

export function detectStopWidened(stopModifications?: StopModification[]): LeakFlag[] {
  if (!stopModifications?.length) return [];

  return stopModifications.flatMap((modification) => {
    const movedAway = modification.side === "BUY" ? modification.final < modification.original : modification.final > modification.original;
    if (!movedAway) return [];
    const originalRisk = Math.abs(modification.original - modification.openPrice);
    const finalRisk = Math.abs(modification.final - modification.openPrice);
    if (originalRisk === 0) return [];
    const riskIncreasePct = finalRisk / originalRisk - 1;
    if (riskIncreasePct <= 0) return [];
    return [
      {
        evidence: {
          finalStop: modification.final,
          originalStop: modification.original,
          riskIncreasePct: round(riskIncreasePct, 4),
          tradeId: modification.tradeId
        },
        severity: riskIncreasePct > 0.5 ? "critical" : ("warning" as const),
        tradeIds: [modification.tradeId],
        type: "stop_widened" as const
      }
    ];
  });
}

export function detectRiskInconsistency(trades: MetricsTrade[], configInput?: Partial<SignalsConfig>): LeakFlag[] {
  const config = mergeSignalsConfig(configInput);
  const risks = trades
    .map((trade) => trade.riskAmount ?? (trade.rMultiple ? Math.abs(netProfit(trade) / trade.rMultiple) : null))
    .filter((risk): risk is number => risk !== null && Number.isFinite(risk) && risk > 0);

  if (risks.length < config.minTradesForCv) return [];
  const meanRisk = mean(risks);
  const stdDevRisk = stdDev(risks);
  const cv = meanRisk === 0 ? 0 : stdDevRisk / meanRisk;
  if (cv <= config.riskCvThreshold) return [];

  return [
    {
      evidence: {
        cv: round(cv, 4),
        meanRisk: round(meanRisk, 2),
        stdDevRisk: round(stdDevRisk, 2),
        tradeCount: risks.length
      },
      severity: cv > 1 ? "critical" : "warning",
      tradeIds: [],
      type: "risk_inconsistency"
    }
  ];
}

export function detectAsymmetricWinLoss(trades: MetricsTrade[], configInput?: Partial<SignalsConfig>): LeakFlag[] {
  const config = mergeSignalsConfig(configInput);
  const core = computeCoreMetrics(trades);
  if (core.avgWinR === null || core.avgLossR === null) return [];
  const ratio = Math.abs(core.avgLossR) === 0 ? Infinity : Math.abs(core.avgWinR) / Math.abs(core.avgLossR);
  if (ratio >= config.asymmetryRatio) return [];

  return [
    {
      evidence: {
        avgLossR: round(core.avgLossR, 4),
        avgWinR: round(core.avgWinR, 4),
        ratio: round(ratio, 4)
      },
      severity: ratio < 0.5 ? "critical" : "warning",
      tradeIds: [],
      type: "asymmetric_win_loss"
    }
  ];
}

export function detectCorrelatedCluster(trades: MetricsTrade[], configInput?: Partial<SignalsConfig>): LeakFlag[] {
  const config = mergeSignalsConfig(configInput);
  const flags: LeakFlag[] = [];
  const seen = new Set<string>();

  for (const [group, symbols] of Object.entries(config.correlationGroups)) {
    const groupTrades = trades.filter((trade) => symbols.includes(trade.symbol));
    for (const trade of groupTrades) {
      const overlapping = groupTrades.filter((candidate) => candidate.id !== trade.id && sameDirectionalExposure(trade, candidate) && overlaps(trade, candidate));
      const cluster = [trade, ...overlapping].sort((a, b) => a.id.localeCompare(b.id));
      if (cluster.length < 2) continue;
      const ids = cluster.map((item) => item.id);
      const key = `${group}:${ids.join("|")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const overlapStart = new Date(Math.max(...cluster.map((item) => toDate(item.openTime).getTime()))).toISOString();
      const overlapEnd = new Date(Math.min(...cluster.map((item) => toDate(item.closeTime).getTime()))).toISOString();
      flags.push({
        evidence: {
          direction: exposureDirection(trade),
          group,
          overlapEnd,
          overlappingTradeIds: ids.join(","),
          overlapStart
        },
        severity: cluster.length >= 3 ? "critical" : "warning",
        tradeIds: ids,
        type: "correlated_cluster"
      });
    }
  }

  return flags;
}

export function detectExcessiveSingleTradeRisk(
  trades: MetricsTrade[],
  snapshots?: EquitySnapshot[],
  startingBalance = 0,
  configInput?: Partial<SignalsConfig>
): LeakFlag[] {
  const config = mergeSignalsConfig(configInput);
  return trades.flatMap((trade) => {
    if (trade.riskAmount === null || trade.riskAmount === undefined || trade.riskAmount <= 0) return [];
    const equityAtOpen = equityAtOrBefore(snapshots, trade.openTime, startingBalance);
    if (!equityAtOpen || equityAtOpen <= 0) return [];
    const riskPct = trade.riskAmount / equityAtOpen;
    if (riskPct <= config.singleTradeRiskPct) return [];

    return [
      {
        evidence: {
          equityAtOpen: round(equityAtOpen, 2),
          riskAmount: round(trade.riskAmount, 2),
          riskPct: round(riskPct, 4),
          tradeId: trade.id
        },
        severity: riskPct > 0.05 ? "critical" : ("warning" as const),
        tradeIds: [trade.id],
        type: "excessive_single_trade_risk" as const
      }
    ];
  });
}

export function detectLeaks(input: DetectLeaksInput): LeakFlag[] {
  const config = mergeSignalsConfig(input.config);
  const trades = sortTrades(input.trades);
  const revenge = detectRevengeTrade(trades, config);
  return sortFlags([
    ...revenge,
    ...detectOvertrading(trades, input.baselineTrades, revenge, config),
    ...detectMissingStopLoss(trades, input.accountEquitySnapshots, config, input.startingBalance),
    ...detectStopWidened(input.stopModifications),
    ...detectRiskInconsistency(trades, config),
    ...detectAsymmetricWinLoss(trades, config),
    ...detectCorrelatedCluster(trades, config),
    ...detectExcessiveSingleTradeRisk(trades, input.accountEquitySnapshots, input.startingBalance, config)
  ]);
}

export function sortFlags(flags: LeakFlag[]) {
  const severityRank = { critical: 0, warning: 1, info: 2 };
  const typeRank = {
    excessive_single_trade_risk: 0,
    revenge_trade: 1,
    missing_stop_loss: 2,
    stop_widened: 3,
    overtrading: 4,
    risk_inconsistency: 5,
    asymmetric_win_loss: 6,
    correlated_cluster: 7
  } satisfies Record<LeakFlag["type"], number>;

  return [...flags].sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || typeRank[a.type] - typeRank[b.type]);
}

function groupByCloseDay(trades: MetricsTrade[], timeZone: string) {
  const byDay = new Map<string, MetricsTrade[]>();
  for (const trade of trades) {
    const key = dateKeyInZone(trade.closeTime, timeZone);
    const current = byDay.get(key) ?? [];
    current.push(trade);
    byDay.set(key, current);
  }
  return byDay;
}

function overlaps(a: MetricsTrade, b: MetricsTrade) {
  return toDate(a.openTime).getTime() < toDate(b.closeTime).getTime() && toDate(b.openTime).getTime() < toDate(a.closeTime).getTime();
}

function exposureDirection(trade: MetricsTrade) {
  // Simple convention: BUY is long the base / short quote; SELL is inverse.
  return trade.side === "BUY" ? "long_base" : "short_base";
}

function sameDirectionalExposure(a: MetricsTrade, b: MetricsTrade) {
  return exposureDirection(a) === exposureDirection(b);
}
