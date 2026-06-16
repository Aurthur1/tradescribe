import { getPrismaClient } from "@tradescribe/db";
import { metaApiGateway, normalizeMetaApiHistory, type NormalizedTrade } from "@tradescribe/metaapi";

interface PrismaDelegate {
  create(input: unknown): Promise<unknown>;
  findFirst(input: unknown): Promise<unknown>;
  findMany(input: unknown): Promise<unknown>;
  update(input: unknown): Promise<unknown>;
  upsert(input: unknown): Promise<unknown>;
}

interface WorkerPrisma {
  alert: PrismaDelegate;
  brokerConnection: PrismaDelegate;
  equitySnapshot: PrismaDelegate;
  trade: PrismaDelegate;
  tradingAccount: PrismaDelegate;
}

interface ConnectionRow {
  broker: string | null;
  id: string;
  lastSyncAt: Date | null;
  metaApiAccountId: string | null;
  platform: "MT4" | "MT5" | null;
  server: string | null;
  status: string;
  userId: string;
  tradingAccounts: Array<{
    currency: string;
    id: string;
    startingBalance: number;
  }>;
}

function humanError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid|auth|credential|password|login/i.test(message)) return "Invalid login or investor password";
  if (/server|broker/i.test(message)) return "Broker server unreachable";
  return "Broker connection is temporarily unavailable";
}

function toTradeUpsert(accountId: string, trade: NormalizedTrade) {
  return {
    create: {
      brokerTimeZone: trade.brokerTimeZone ?? null,
      closePrice: trade.closePrice,
      closeTime: trade.closeTime,
      commission: trade.commission,
      durationSec: trade.durationSec,
      externalId: trade.externalId,
      grossProfit: trade.grossProfit,
      openPrice: trade.openPrice,
      openTime: trade.openTime,
      rMultiple: trade.rMultiple,
      riskAmount: trade.riskAmount,
      session: trade.session,
      side: trade.side,
      stopLoss: trade.stopLoss,
      swap: trade.swap,
      symbol: trade.symbol,
      takeProfit: trade.takeProfit,
      tradingAccountId: accountId,
      volume: trade.volume
    },
    update: {
      brokerTimeZone: trade.brokerTimeZone ?? null,
      closePrice: trade.closePrice,
      closeTime: trade.closeTime,
      commission: trade.commission,
      durationSec: trade.durationSec,
      grossProfit: trade.grossProfit,
      openPrice: trade.openPrice,
      openTime: trade.openTime,
      rMultiple: trade.rMultiple,
      riskAmount: trade.riskAmount,
      session: trade.session,
      side: trade.side,
      stopLoss: trade.stopLoss,
      swap: trade.swap,
      symbol: trade.symbol,
      takeProfit: trade.takeProfit,
      volume: trade.volume
    },
    where: {
      tradingAccountId_externalId: {
        externalId: trade.externalId,
        tradingAccountId: accountId
      }
    }
  };
}

async function connection(prisma: WorkerPrisma, connectionId: string) {
  return (await prisma.brokerConnection.findFirst({
    where: { id: connectionId },
    include: { tradingAccounts: true }
  })) as ConnectionRow | null;
}

async function syncConnection(connectionId: string, mode: "backfill" | "sync") {
  const prisma = (await getPrismaClient()) as unknown as WorkerPrisma;
  const row = await connection(prisma, connectionId);
  const account = row?.tradingAccounts[0];
  if (!row || !account || !row.metaApiAccountId || !row.platform) return { synced: 0, skipped: true };

  const now = new Date();
  const startTime =
    mode === "backfill"
      ? new Date(now.getTime() - 1000 * 60 * 60 * 24 * 365 * 2)
      : new Date((row.lastSyncAt?.getTime() ?? now.getTime() - 1000 * 60 * 60 * 24) - 1000 * 60 * 60);

  try {
    await prisma.brokerConnection.update({ where: { id: row.id }, data: { lastError: null, status: "SYNCING" } });
    const info = await metaApiGateway.getAccountInformation(row.metaApiAccountId);
    const records =
      row.platform === "MT5"
        ? await metaApiGateway.getDealsByTimeRange(row.metaApiAccountId, { endTime: now, startTime })
        : await metaApiGateway.getHistoryOrders(row.metaApiAccountId, { endTime: now, startTime });
    const trades = normalizeMetaApiHistory({
      accountCurrency: info.currency ?? account.currency,
      platform: row.platform,
      records
    });

    for (const trade of trades) {
      await prisma.trade.upsert(toTradeUpsert(account.id, trade));
    }

    const previousSnapshot = (await prisma.equitySnapshot.findFirst({
      where: { tradingAccountId: account.id },
      orderBy: { ts: "desc" }
    })) as { balance: number; equity: number } | null;
    if (!previousSnapshot || previousSnapshot.balance !== info.balance || previousSnapshot.equity !== info.equity) {
      await prisma.equitySnapshot.create({
        data: {
          balance: info.balance,
          equity: info.equity,
          tradingAccountId: account.id,
          ts: now
        }
      });
    }

    await prisma.tradingAccount.update({
      where: { id: account.id },
      data: {
        currency: (info.currency ?? account.currency).toUpperCase(),
        startingBalance: account.startingBalance || info.balance
      }
    });
    await prisma.brokerConnection.update({
      where: { id: row.id },
      data: { lastError: null, lastSyncAt: now, status: "CONNECTED" }
    });
    return { synced: trades.length };
  } catch (error) {
    const lastError = humanError(error);
    await prisma.brokerConnection.update({
      where: { id: row.id },
      data: { lastError, status: row.status === "CONNECTED" || row.status === "SYNCING" ? "DEGRADED" : "DISCONNECTED" }
    });
    await prisma.alert.create({
      data: {
        channel: "in_app",
        payload: { connectionId: row.id, message: lastError },
        severity: "warning",
        type: "sync_failure",
        userId: row.userId
      }
    });
    throw error;
  }
}

export function runConnectionBackfillJob(data: { connectionId: string }) {
  return syncConnection(data.connectionId, "backfill");
}

export function runConnectionSyncJob(data: { connectionId: string }) {
  return syncConnection(data.connectionId, "sync");
}
