import { getPrismaClient } from "@tradescribe/db";
import type { MetricsTrade } from "@tradescribe/metrics";
import { detectLeaks, evaluateGuardrails, type PropFirmRules } from "@tradescribe/signals";

interface PrismaDelegate {
  create(input: unknown): Promise<unknown>;
  findFirst(input: unknown): Promise<unknown>;
  findMany(input: unknown): Promise<unknown>;
  findUnique(input: unknown): Promise<unknown>;
}

interface WorkerPrisma {
  $transaction<T>(operations: Promise<T>[]): Promise<T[]>;
  alert: PrismaDelegate;
  equitySnapshot: PrismaDelegate;
  leakFlag: PrismaDelegate;
  trade: PrismaDelegate;
  tradingAccount: PrismaDelegate;
}

interface TradeRow {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
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
}

function toMetricsTrade(row: TradeRow): MetricsTrade {
  return {
    closePrice: row.closePrice,
    closeTime: row.closeTime,
    commission: row.commission,
    durationSec: row.durationSec,
    grossProfit: row.grossProfit,
    id: row.id,
    openPrice: row.openPrice,
    openTime: row.openTime,
    riskAmount: row.riskAmount,
    rMultiple: row.rMultiple,
    side: row.side,
    stopLoss: row.stopLoss,
    swap: row.swap,
    symbol: row.symbol,
    takeProfit: row.takeProfit,
    volume: row.volume
  };
}

export async function runLeaksDetectJob(data: { tradingAccountId: string; periodStart?: string; periodEnd?: string; timeZone?: string }) {
  const prisma = (await getPrismaClient()) as unknown as WorkerPrisma;
  const account = (await prisma.tradingAccount.findUnique({
    where: { id: data.tradingAccountId },
    include: { brokerConnection: { include: { user: true } } }
  })) as { id: string; startingBalance: number; brokerConnection: { userId: string; user: { email?: string | null } } } | null;
  if (!account) return { inserted: 0 };

  const where = {
    tradingAccountId: data.tradingAccountId,
    ...(data.periodStart && data.periodEnd ? { closeTime: { gte: new Date(data.periodStart), lt: new Date(data.periodEnd) } } : {})
  };
  const rows = (await prisma.trade.findMany({ where, orderBy: { openTime: "asc" } })) as TradeRow[];
  const snapshots = (await prisma.equitySnapshot.findMany({ where: { tradingAccountId: data.tradingAccountId }, orderBy: { ts: "asc" } })) as Array<{
    ts: Date;
    equity: number;
    balance: number;
  }>;
  const flags = detectLeaks({
    accountEquitySnapshots: snapshots,
    config: { timeZone: data.timeZone ?? "UTC" },
    startingBalance: account.startingBalance,
    trades: rows.map(toMetricsTrade)
  });
  let inserted = 0;

  for (const flag of flags) {
    const existing = await prisma.leakFlag.findFirst({
      where: {
        tradingAccountId: data.tradingAccountId,
        type: flag.type,
        tradeIds: { equals: flag.tradeIds },
        periodStart: flag.periodStart ? new Date(flag.periodStart) : null
      }
    });
    if (existing) continue;
    inserted += 1;
    await prisma.leakFlag.create({
      data: {
        evidence: flag.evidence,
        periodEnd: flag.periodEnd ? new Date(flag.periodEnd) : null,
        periodStart: flag.periodStart ? new Date(flag.periodStart) : null,
        severity: flag.severity,
        tradeIds: flag.tradeIds,
        tradingAccountId: data.tradingAccountId,
        type: flag.type
      }
    });
    if (flag.severity === "critical") {
      await prisma.alert.create({
        data: {
          channel: "in_app",
          payload: flag,
          severity: flag.severity,
          tradingAccountId: data.tradingAccountId,
          type: "leak_flag",
          userId: account.brokerConnection.userId
        }
      });
    }
  }

  return { inserted };
}

export async function runGuardrailCheckJob(data: { tradingAccountId: string; timeZone?: string }) {
  const prisma = (await getPrismaClient()) as unknown as WorkerPrisma;
  const account = (await prisma.tradingAccount.findUnique({
    where: { id: data.tradingAccountId },
    include: { brokerConnection: true, propFirmRuleSet: true }
  })) as { id: string; startingBalance: number; brokerConnection: { userId: string }; propFirmRuleSet: (Omit<PropFirmRules, "startingBalance"> & { id: string }) | null } | null;
  if (!account?.propFirmRuleSet) return { status: null };

  const [rows, snapshots] = (await prisma.$transaction([
    prisma.trade.findMany({ where: { tradingAccountId: data.tradingAccountId }, orderBy: { closeTime: "asc" } }),
    prisma.equitySnapshot.findMany({ where: { tradingAccountId: data.tradingAccountId }, orderBy: { ts: "asc" } })
  ])) as [TradeRow[], Array<{ ts: Date; equity: number; balance: number }>];
  const status = evaluateGuardrails(
    snapshots,
    rows.map(toMetricsTrade),
    { ...account.propFirmRuleSet, startingBalance: account.startingBalance },
    new Date(),
    data.timeZone ?? "UTC"
  );
  const latest = (await prisma.alert.findFirst({
    where: { tradingAccountId: data.tradingAccountId, type: { in: ["guardrail_warning", "guardrail_breached"] } },
    orderBy: { createdAt: "desc" }
  })) as { payload: { overallStatus?: string } } | null;
  const previous = latest?.payload?.overallStatus ?? "ok";
  if (previous !== status.overallStatus && status.overallStatus !== "ok") {
    await prisma.alert.create({
      data: {
        channel: "in_app",
        payload: status,
        severity: status.overallStatus,
        tradingAccountId: data.tradingAccountId,
        type: status.overallStatus === "breached" ? "guardrail_breached" : "guardrail_warning",
        userId: account.brokerConnection.userId
      }
    });
  }
  return status;
}
