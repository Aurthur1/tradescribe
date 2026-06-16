import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { computeMetrics, type MetricsResult } from '@tradescribe/metrics';
import { PrismaService } from '../prisma/prisma.service'; // your existing Prisma provider
import { RedisService } from '../redis/redis.service'; // your existing Redis provider
import { resolvePeriod, type Granularity } from './period.util';
import { toMetricsTrade, rowSession, type TradeRow } from './trade.mapper';
import type { MetricsQuery, TradesQuery } from './metrics.dto';

const CACHE_TTL_SECONDS = 60;

@Injectable()
export class MetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Verify the account belongs to the user. Throws if not. Prevents IDOR. */
  private async assertOwnership(userId: string, accountId: string) {
    const account = await this.prisma.tradingAccount.findFirst({
      where: { id: accountId, brokerConnection: { userId } },
      select: { id: true, currency: true, startingBalance: true },
    });
    if (!account) throw new ForbiddenException('Account not found or not yours');
    return account;
  }

  private cacheKey(accountId: string, q: MetricsQuery) {
    return `metrics:${accountId}:${q.granularity}:${q.anchor ?? 'now'}:${q.tz}:${q.symbol ?? '*'}:${q.session ?? '*'}:${q.side ?? '*'}`;
  }

  private filterRows(rows: TradeRow[], q: MetricsQuery): TradeRow[] {
    return rows.filter((r) => {
      if (q.symbol && r.symbol !== q.symbol) return false;
      if (q.side && r.side !== q.side) return false;
      if (q.session && rowSession(r) !== q.session) return false;
      return true;
    });
  }

  async getMetrics(userId: string, accountId: string, q: MetricsQuery): Promise<MetricsResult & { period: { label: string; granularity: Granularity } }> {
    const account = await this.assertOwnership(userId, accountId);

    const cacheKey = this.cacheKey(accountId, q);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const { current, previous, granularity } = resolvePeriod(q.granularity, q.anchor, q.tz);

    // Load current + previous window in one query, then split. Symbol/side filtered in DB;
    // session filtered in app (derived) unless you persist it.
    const rows = (await this.prisma.trade.findMany({
      where: {
        tradingAccountId: accountId,
        closeTime: { gte: previous.start, lt: current.end },
        ...(q.symbol ? { symbol: q.symbol } : {}),
        ...(q.side ? { side: q.side } : {}),
      },
      orderBy: { closeTime: 'asc' },
    })) as unknown as TradeRow[];

    const inCurrent = this.filterRows(rows.filter((r) => r.closeTime >= current.start && r.closeTime < current.end), q);
    const inPrevious = this.filterRows(rows.filter((r) => r.closeTime >= previous.start && r.closeTime < current.start), q);

    const snapshots = await this.prisma.equitySnapshot.findMany({
      where: { tradingAccountId: accountId, ts: { gte: current.start, lt: current.end } },
      orderBy: { ts: 'asc' },
    });

    const result = computeMetrics({
      trades: inCurrent.map(toMetricsTrade),
      previousTrades: inPrevious.map(toMetricsTrade),
      equitySnapshots: snapshots.map((s) => ({ ts: s.ts, equity: s.equity, balance: s.balance })),
      startingBalance: account.startingBalance ?? 0,
      timeZone: q.tz,
    });

    const payload = { ...result, period: { label: current.label, granularity } };
    await this.redis.set(cacheKey, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS);
    return payload;
  }

  async getTrades(userId: string, accountId: string, q: TradesQuery) {
    await this.assertOwnership(userId, accountId);
    const { current } = resolvePeriod(q.granularity, q.anchor, q.tz);

    const where = {
      tradingAccountId: accountId,
      closeTime: { gte: current.start, lt: current.end },
      ...(q.symbol ? { symbol: q.symbol } : {}),
      ...(q.side ? { side: q.side } : {}),
    };

    const [rowsRaw, total] = await this.prisma.$transaction([
      this.prisma.trade.findMany({
        where,
        orderBy: { [q.sort === 'netProfit' ? 'grossProfit' : q.sort]: q.order },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.trade.count({ where }),
    ]);

    let rows = rowsRaw as unknown as TradeRow[];
    if (q.session) rows = rows.filter((r) => rowSession(r) === q.session);

    return {
      data: rows.map((r) => ({ ...r, session: rowSession(r), netProfit: r.grossProfit + r.commission + r.swap })),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    };
  }

  async getTrade(userId: string, tradeId: string) {
    const row = (await this.prisma.trade.findFirst({
      where: { id: tradeId, tradingAccount: { brokerConnection: { userId } } },
      include: { notes: true, journalEntry: true },
    })) as unknown as (TradeRow & Record<string, unknown>) | null;
    if (!row) throw new NotFoundException('Trade not found');
    return { ...row, session: rowSession(row), netProfit: row.grossProfit + row.commission + row.swap };
  }
}
