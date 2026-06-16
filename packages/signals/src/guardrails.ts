import { computeDailySeries, netProfit, toDate, type EquitySnapshot, type MetricsTrade } from "@tradescribe/metrics";
import type { GuardrailLimitStatus, GuardrailStatus, PropFirmRules } from "./types.js";

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function statusFor(usedPct: number, threshold: number): GuardrailLimitStatus {
  if (usedPct >= 1) return "breached";
  if (usedPct >= threshold) return "warning";
  return "ok";
}

function overall(parts: Array<GuardrailLimitStatus | undefined>): GuardrailLimitStatus {
  if (parts.includes("breached")) return "breached";
  if (parts.includes("warning")) return "warning";
  return "ok";
}

function dateKeyInZone(when: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).format(when);
}

function sortedSnapshots(snapshots: EquitySnapshot[]) {
  return [...snapshots].sort((a, b) => toDate(a.ts).getTime() - toDate(b.ts).getTime());
}

function currentEquity(snapshots: EquitySnapshot[], fallback: number) {
  return sortedSnapshots(snapshots).at(-1)?.equity ?? fallback;
}

export function evaluateGuardrails(
  snapshots: EquitySnapshot[],
  trades: MetricsTrade[],
  rules: PropFirmRules,
  now: Date,
  timeZone = "UTC"
): GuardrailStatus {
  const alertThreshold = rules.alertThresholdPct;
  const sorted = sortedSnapshots(snapshots);
  const current = currentEquity(sorted, rules.startingBalance + trades.reduce((sum, trade) => sum + netProfit(trade), 0));
  const today = dateKeyInZone(now, timeZone);
  const todaySnapshots = sorted.filter((snapshot) => dateKeyInZone(toDate(snapshot.ts), timeZone) === today);
  const result: GuardrailStatus = { overallStatus: "ok" };

  if (rules.maxDailyLossPct) {
    const first = todaySnapshots[0];
    const dayStartValue = rules.maxDailyLossMode === "equity" ? first?.equity ?? rules.startingBalance : first?.balance ?? rules.startingBalance;
    const minEquity = Math.min(dayStartValue, ...todaySnapshots.map((snapshot) => snapshot.equity), current);
    const lossSoFar = Math.max(0, dayStartValue - minEquity);
    const limitAmount = dayStartValue * rules.maxDailyLossPct;
    const usedPct = limitAmount > 0 ? lossSoFar / limitAmount : 0;
    result.dailyLoss = {
      limitPct: rules.maxDailyLossPct,
      remainingAmount: round(Math.max(0, limitAmount - lossSoFar), 2),
      status: statusFor(usedPct, alertThreshold),
      usedPct: round(usedPct, 4)
    };
  }

  if (rules.maxDrawdownPct) {
    const highWaterMark = rules.maxDrawdownMode === "trailing" ? Math.max(rules.startingBalance, ...sorted.map((snapshot) => snapshot.equity), current) : rules.startingBalance;
    const drawdown = Math.max(0, highWaterMark - current);
    const limitAmount = highWaterMark * rules.maxDrawdownPct;
    const usedPct = limitAmount > 0 ? drawdown / limitAmount : 0;
    result.drawdown = {
      limitPct: rules.maxDrawdownPct,
      mode: rules.maxDrawdownMode,
      remainingAmount: round(Math.max(0, limitAmount - drawdown), 2),
      status: statusFor(usedPct, alertThreshold),
      usedPct: round(usedPct, 4)
    };
  }

  if (rules.profitTargetPct) {
    const targetAmount = rules.startingBalance * rules.profitTargetPct;
    const progressPct = targetAmount > 0 ? Math.max(0, (current - rules.startingBalance) / targetAmount) : 0;
    result.profitTarget = {
      progressPct: round(progressPct, 4),
      status: progressPct >= 1 ? "reached" : "in_progress",
      targetPct: rules.profitTargetPct
    };
  }

  if (rules.consistencyMaxDailyProfitPct) {
    const daily = computeDailySeries(trades, timeZone);
    const positive = daily.map((day) => day.netPnl).filter((value) => value > 0);
    const totalProfit = positive.reduce((sum, value) => sum + value, 0);
    if (totalProfit > 0) {
      const worstDayPct = Math.max(...positive) / totalProfit;
      result.consistency = {
        limitPct: rules.consistencyMaxDailyProfitPct,
        status: statusFor(worstDayPct / rules.consistencyMaxDailyProfitPct, alertThreshold),
        worstDayPct: round(worstDayPct, 4)
      };
    }
  }

  result.overallStatus = overall([result.dailyLoss?.status, result.drawdown?.status, result.consistency?.status]);
  return result;
}
