import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { computeMetrics, type MetricsResult } from "@tradescribe/metrics";
import { PrismaService } from "../prisma/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";
import type { MetricsQuery, TradesQuery } from "./metrics.dto.js";
import { resolvePeriod, type Granularity } from "./period.util.js";
import { rowSession, toMetricsTrade, type TradeRow } from "./trade.mapper.js";

const CACHE_TTL_SECONDS = 60;

@Injectable()
export class MetricsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redis: RedisService
  ) {}

  private async assertOwnership(userId: string, accountId: string) {
    const prisma = await this.prismaService.client();
    const account = await prisma.tradingAccount.findFirst({
      where: { id: accountId, brokerConnection: { userId } },
      select: { id: true, currency: true, startingBalance: true }
    });

    if (!account) {
      throw new ForbiddenException("Account not found or not yours");
    }

    return account as { id: string; currency: string; startingBalance: number | null };
  }

  private cacheKey(accountId: string, query: MetricsQuery) {
    return `metrics:${accountId}:${query.granularity}:${query.anchor ?? "now"}:${query.tz}:${query.symbol ?? "*"}:${query.session ?? "*"}:${query.side ?? "*"}:${query.date ?? query.day ?? "*"}`;
  }

  private filterRows(rows: TradeRow[], query: MetricsQuery): TradeRow[] {
    return rows.filter((row) => {
      if (query.symbol && row.symbol !== query.symbol) return false;
      if (query.side && row.side !== query.side) return false;
      if (query.session && rowSession(row) !== query.session) return false;
      return true;
    });
  }

  async getMetrics(
    userId: string,
    accountId: string,
    query: MetricsQuery
  ): Promise<MetricsResult & { period: { label: string; granularity: Granularity } }> {
    const account = await this.assertOwnership(userId, accountId);
    const cacheKey = this.cacheKey(accountId, query);
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as MetricsResult & { period: { label: string; granularity: Granularity } };
    }

    const prisma = await this.prismaService.client();
    const dateOverride = query.date ?? query.day;
    const { current, previous, granularity } = dateOverride
      ? resolvePeriod("day", `${dateOverride}T12:00:00.000Z`, query.tz)
      : resolvePeriod(query.granularity, query.anchor, query.tz);

    const rows = (await prisma.trade.findMany({
      where: {
        tradingAccountId: accountId,
        closeTime: { gte: previous.start, lt: current.end },
        ...(query.symbol ? { symbol: query.symbol } : {}),
        ...(query.side ? { side: query.side } : {})
      },
      orderBy: { closeTime: "asc" }
    })) as TradeRow[];

    const currentRows = this.filterRows(
      rows.filter((row) => row.closeTime >= current.start && row.closeTime < current.end),
      query
    );
    const previousRows = this.filterRows(
      rows.filter((row) => row.closeTime >= previous.start && row.closeTime < current.start),
      query
    );

    const snapshots = (await prisma.equitySnapshot.findMany({
      where: { tradingAccountId: accountId, ts: { gte: current.start, lt: current.end } },
      orderBy: { ts: "asc" }
    })) as Array<{ ts: Date; equity: number; balance: number }>;

    const result = computeMetrics({
      trades: currentRows.map(toMetricsTrade),
      previousTrades: previousRows.map(toMetricsTrade),
      equitySnapshots: snapshots.map((snapshot) => ({
        ts: snapshot.ts,
        equity: snapshot.equity,
        balance: snapshot.balance
      })),
      startingBalance: account.startingBalance ?? 0,
      timeZone: query.tz
    });

    const payload = { ...result, period: { label: current.label, granularity: dateOverride ? query.granularity : granularity } };
    await this.redis.set(cacheKey, JSON.stringify(payload), "EX", CACHE_TTL_SECONDS);
    return payload;
  }

  async getTrades(userId: string, accountId: string, query: TradesQuery) {
    await this.assertOwnership(userId, accountId);
    const prisma = await this.prismaService.client();
    const period = query.allTime ? null : resolvePeriod(query.granularity, query.anchor, query.tz).current;
    const from = query.from ? new Date(query.from) : period?.start;
    const to = query.to ? new Date(query.to) : period?.end;
    const orderBy = query.sort === "netProfit" ? { closeTime: "desc" as const } : { [query.sort]: query.order };

    const where = {
      tradingAccountId: accountId,
      ...(from || to ? { closeTime: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(query.symbol ? { symbol: query.symbol } : {}),
      ...(query.side ? { side: query.side } : {}),
      ...(query.emotionTag ? { notes: { some: { emotionTags: { has: query.emotionTag } } } } : {}),
      ...(query.playbookId ? { playbookId: query.playbookId === "untagged" ? null : query.playbookId } : {})
    };

    const [rowsRaw, totalRaw] = (await prisma.$transaction([
      prisma.trade.findMany({
        where,
        orderBy,
        include: { notes: true, playbook: { select: { color: true, id: true, name: true } } },
        take: 1000
      }),
      prisma.trade.count({ where })
    ])) as [TradeRow[], number];

    const filteredRows = query.session ? rowsRaw.filter((row) => rowSession(row) === query.session) : rowsRaw;
    const sortedRows =
      query.sort === "netProfit"
        ? [...filteredRows].sort((a, b) => {
            const left = a.grossProfit + a.commission + a.swap;
            const right = b.grossProfit + b.commission + b.swap;
            return query.order === "asc" ? left - right : right - left;
          })
        : filteredRows;
    const rows = sortedRows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
    const total = query.session ? filteredRows.length : totalRaw;

    return {
      data: rows.map((row) => ({
        ...row,
        session: rowSession(row),
        playbook: (row as unknown as Record<string, unknown>).playbook ?? null,
        netProfit: row.grossProfit + row.commission + row.swap
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize)
    };
  }

  async getTrade(userId: string, tradeId: string) {
    const prisma = await this.prismaService.client();
    const row = (await prisma.trade.findFirst({
      where: { id: tradeId, tradingAccount: { brokerConnection: { userId } } },
      include: {
        journalEntry: true,
        notes: { orderBy: { updatedAt: "desc" } },
        playbook: { select: { color: true, id: true, name: true, rules: true } },
        screenshots: { orderBy: { createdAt: "desc" } },
        tradingAccount: { select: { currency: true, id: true, login: true, name: true } }
      }
    })) as (TradeRow & Record<string, unknown>) | null;

    if (!row) {
      throw new NotFoundException("Trade not found");
    }

    return {
      ...row,
      leakFlags: await prisma.leakFlag.findMany({
        where: { tradingAccountId: row.tradingAccountId, tradeIds: { has: tradeId } },
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }]
      }),
      session: rowSession(row),
      netProfit: row.grossProfit + row.commission + row.swap
    };
  }

  async saveTradeNote(userId: string, tradeId: string, body: { body: string; emotionTags: string[]; playbookChecklist?: Array<{ checked: boolean; ruleIndex: number }> }) {
    await this.getTrade(userId, tradeId);
    const prisma = await this.prismaService.client();
    const existing = (await prisma.tradeNote.findFirst({
      where: { tradeId },
      orderBy: { updatedAt: "desc" }
    })) as { id: string } | null;

    const data = {
      body: body.body,
      emotion: body.emotionTags[0] ?? null,
      emotionTags: body.emotionTags,
      ...(body.playbookChecklist !== undefined ? { playbookChecklist: body.playbookChecklist } : {})
    };

    return existing
      ? prisma.tradeNote.update({ where: { id: existing.id }, data })
      : prisma.tradeNote.create({ data: { ...data, tradeId } });
  }

  async addTradeScreenshot(
    userId: string,
    tradeId: string,
    body: { filename?: string; mimeType?: string; storageKey?: string; url: string }
  ) {
    await this.getTrade(userId, tradeId);
    const prisma = await this.prismaService.client();
    return prisma.tradeScreenshot.create({
      data: {
        filename: body.filename,
        mimeType: body.mimeType,
        storageKey: body.storageKey,
        tradeId,
        url: body.url
      }
    });
  }

  async createScreenshotUpload(userId: string, tradeId: string, body: { filename: string; mimeType: string }) {
    await this.getTrade(userId, tradeId);
    const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "screenshot";
    const storageKey = `trade-screenshots/${tradeId}/${Date.now()}-${safeName}`;
    return {
      headers: {},
      method: "PUT",
      publicUrl: null,
      storageKey,
      uploadUrl: null
    };
  }
}
