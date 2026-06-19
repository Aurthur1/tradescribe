import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { computeMetrics, type MetricsResult } from "@tradescribe/metrics";
import { PrismaService } from "../prisma/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";
import type { MetricsQuery, TradesQuery } from "./metrics.dto.js";
import { resolvePeriod, type Granularity } from "./period.util.js";
import { rowSession, toMetricsTrade, type TradeRow } from "./trade.mapper.js";

const CACHE_TTL_SECONDS = 60;
const weekdayLookup: Record<string, number> = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2, wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };

function netProfitOf(row: TradeRow) {
  return row.grossProfit + row.commission + row.swap;
}

function matchesDayOfWeek(value: Date, filter: string, timeZone: string) {
  const wanted = filter
    .split(",")
    .map((item) => weekdayLookup[item.trim().toLowerCase()])
    .filter((item): item is number => item !== undefined);
  if (wanted.length === 0) return true;
  const weekday = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" })
      .formatToParts(value)
      .find((part) => part.type === "weekday")
      ?.value.replace(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/, (day) => String(weekdayLookup[day.toLowerCase()])) ?? "-1"
  );
  return wanted.includes(weekday);
}

function sortTradeRows<T extends TradeRow>(rows: T[], query: TradesQuery): T[] {
  const sortSpec = query.sortSpec
    ? query.sortSpec.split(",").map((item) => {
        const trimmed = item.trim();
        return { direction: trimmed.startsWith("-") ? -1 : 1, key: trimmed.replace(/^-/, "") };
      })
    : [{ direction: query.order === "asc" ? 1 : -1, key: query.sort }];

  return [...rows].sort((a, b) => {
    for (const spec of sortSpec) {
      const left = sortableTradeValue(a, spec.key);
      const right = sortableTradeValue(b, spec.key);
      if (left < right) return -1 * spec.direction;
      if (left > right) return 1 * spec.direction;
    }
    return b.closeTime.getTime() - a.closeTime.getTime();
  });
}

function sortableTradeValue(row: TradeRow, key: string) {
  switch (key) {
    case "netProfit":
      return netProfitOf(row);
    case "symbol":
      return row.symbol;
    case "volume":
      return row.volume;
    case "openPrice":
      return row.openPrice;
    case "closePrice":
      return row.closePrice;
    case "rMultiple":
      return row.rMultiple ?? Number.NEGATIVE_INFINITY;
    case "durationSec":
      return row.durationSec ?? 0;
    case "closeTime":
    default:
      return row.closeTime.getTime();
  }
}

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
    return `metrics:${accountId}:${query.granularity}:${query.anchor ?? "now"}:${query.tz}:${query.symbol ?? "*"}:${query.session ?? "*"}:${query.side ?? "*"}:${query.emotionTag ?? "*"}:${query.playbookId ?? "*"}:${query.date ?? query.day ?? "*"}`;
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
        ...(query.side ? { side: query.side } : {}),
        ...(query.emotionTag ? { notes: { some: { emotionTags: { has: query.emotionTag } } } } : {}),
        ...(query.playbookId ? { playbookId: query.playbookId === "untagged" ? null : query.playbookId } : {})
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
    const account = await this.assertOwnership(userId, accountId);
    const prisma = await this.prismaService.client();
    const period = query.allTime ? null : resolvePeriod(query.granularity, query.anchor, query.tz).current;
    const from = query.from ? new Date(query.from) : period?.start;
    const to = query.to ? new Date(query.to) : period?.end;
    const symbols = query.symbol?.split(",").map((symbol) => symbol.trim()).filter(Boolean);
    const playbookIds = query.playbookId?.split(",").map((id) => id.trim()).filter(Boolean);
    const emotionTags = query.emotionTag?.split(",").map((tag) => tag.trim()).filter(Boolean);
    const leakTypes = query.leakType?.split(",").map((type) => type.trim()).filter(Boolean);

    const where = {
      tradingAccountId: accountId,
      ...(from || to ? { closeTime: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(symbols?.length ? { symbol: { in: symbols } } : {}),
      ...(query.side ? { side: query.side } : {}),
      ...(query.q
        ? {
            OR: [
              { symbol: { contains: query.q, mode: "insensitive" as const } },
              { notes: { some: { body: { contains: query.q, mode: "insensitive" as const } } } },
              { notes: { some: { emotionTags: { has: query.q } } } }
            ]
          }
        : {}),
      ...(query.hasNote ? { notes: { some: {} } } : {}),
      ...(query.needsReview ? { notes: { none: {} } } : {}),
      ...(query.hasScreenshot ? { screenshots: { some: {} } } : {}),
      ...(emotionTags?.length ? { notes: { some: { emotionTags: { hasSome: emotionTags } } } } : {}),
      ...(playbookIds?.length ? { playbookId: playbookIds.includes("untagged") ? null : { in: playbookIds } } : {})
    };

    const [rowsRaw] = (await prisma.$transaction([
      prisma.trade.findMany({
        where,
        orderBy: { closeTime: "desc" },
        include: {
          journalEntry: true,
          notes: { orderBy: { updatedAt: "desc" }, take: 3 },
          playbook: { select: { color: true, id: true, name: true } },
          screenshots: { orderBy: { createdAt: "desc" }, select: { createdAt: true, filename: true, id: true, mimeType: true, storageKey: true, url: true }, take: 3 }
        },
        take: 10000
      })
    ])) as [Array<TradeRow & { journalEntry?: unknown; notes?: Array<{ body: string; emotionTags: string[] }>; playbook?: unknown; screenshots?: Array<{ id: string }> }>];

    const leakRows = (await prisma.leakFlag.findMany({
      where: {
        tradingAccountId: accountId,
        ...(leakTypes?.length ? { type: { in: leakTypes } } : {})
      },
      select: { id: true, severity: true, tradeIds: true, type: true }
    })) as Array<{ id: string; severity: string; tradeIds: string[]; type: string }>;
    const flagsByTrade = new Map<string, Array<{ id: string; severity: string; type: string }>>();
    for (const flag of leakRows) {
      for (const tradeId of flag.tradeIds) {
        const current = flagsByTrade.get(tradeId) ?? [];
        current.push({ id: flag.id, severity: flag.severity, type: flag.type });
        flagsByTrade.set(tradeId, current);
      }
    }

    const filteredRows = rowsRaw.filter((row) => {
      const net = row.grossProfit + row.commission + row.swap;
      const session = rowSession(row);
      if (query.session && session !== query.session) return false;
      if (query.dayOfWeek && !matchesDayOfWeek(row.closeTime, query.dayOfWeek, query.tz)) return false;
      if (query.pnlSign === "win" && net <= 0) return false;
      if (query.pnlSign === "loss" && net >= 0) return false;
      if (query.pnlSign === "breakeven" && net !== 0) return false;
      if (query.rMin !== undefined && (row.rMultiple === null || row.rMultiple < query.rMin)) return false;
      if (query.rMax !== undefined && (row.rMultiple === null || row.rMultiple > query.rMax)) return false;
      if (query.durationMin !== undefined && (row.durationSec ?? 0) < query.durationMin) return false;
      if (query.durationMax !== undefined && (row.durationSec ?? 0) > query.durationMax) return false;
      if (query.volumeMin !== undefined && row.volume < query.volumeMin) return false;
      if (query.volumeMax !== undefined && row.volume > query.volumeMax) return false;
      if (leakTypes?.length && !(flagsByTrade.get(row.id) ?? []).some((flag) => leakTypes.includes(flag.type))) return false;
      return true;
    });

    const sortedRows = sortTradeRows(filteredRows, query);
    const metrics = computeMetrics({
      trades: filteredRows.map(toMetricsTrade),
      startingBalance: account.startingBalance ?? 0,
      timeZone: query.tz
    });
    const rows = sortedRows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
    const total = filteredRows.length;

    return {
      data: rows.map((row) => ({
        ...row,
        session: rowSession(row),
        playbook: (row as unknown as Record<string, unknown>).playbook ?? null,
        emotionTags: Array.from(new Set((row.notes ?? []).flatMap((note) => note.emotionTags ?? []))),
        hasNote: Boolean(row.notes?.length),
        hasScreenshot: Boolean(row.screenshots?.length),
        journalEntry: (row as unknown as Record<string, unknown>).journalEntry ?? null,
        leakFlags: flagsByTrade.get(row.id) ?? [],
        netProfit: row.grossProfit + row.commission + row.swap
      })),
      metrics,
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

  async bulkSetPlaybook(userId: string, body: { tradeIds: string[]; playbookId: string | null }) {
    const prisma = await this.prismaService.client();
    const trades = (await prisma.trade.findMany({
      where: { id: { in: body.tradeIds }, tradingAccount: { brokerConnection: { userId } } },
      select: { id: true }
    })) as Array<{ id: string }>;
    if (trades.length !== new Set(body.tradeIds).size) throw new ForbiddenException("One or more trades are not yours");

    if (body.playbookId) {
      const playbook = await prisma.playbook.findFirst({ where: { id: body.playbookId, userId }, select: { id: true } });
      if (!playbook) throw new ForbiddenException("Playbook not found or not yours");
    }

    const result = await prisma.trade.updateMany({
      where: { id: { in: body.tradeIds }, tradingAccount: { brokerConnection: { userId } } },
      data: { playbookId: body.playbookId }
    });
    return { updated: result.count };
  }

  async bulkAddEmotion(userId: string, body: { tradeIds: string[]; emotionTag: string }) {
    const prisma = await this.prismaService.client();
    const trades = (await prisma.trade.findMany({
      where: { id: { in: body.tradeIds }, tradingAccount: { brokerConnection: { userId } } },
      include: { notes: { orderBy: { updatedAt: "desc" }, take: 1 } }
    })) as Array<{ id: string; notes: Array<{ id: string; body: string; emotionTags: string[] }> }>;
    if (trades.length !== new Set(body.tradeIds).size) throw new ForbiddenException("One or more trades are not yours");

    await prisma.$transaction(
      trades.map((trade) => {
        const existing = trade.notes[0];
        const tags = Array.from(new Set([...(existing?.emotionTags ?? []), body.emotionTag]));
        return existing
          ? prisma.tradeNote.update({ where: { id: existing.id }, data: { emotion: tags[0] ?? null, emotionTags: tags } })
          : prisma.tradeNote.create({ data: { body: "", emotion: body.emotionTag, emotionTags: tags, tradeId: trade.id } });
      })
    );
    return { updated: trades.length };
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
