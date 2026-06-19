import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { computeMetrics, type MetricsResult } from "@tradescribe/metrics";
import { z, ZodError, type ZodTypeAny } from "zod";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { MetricsQuerySchema } from "../metrics/metrics.dto.js";
import { resolvePeriod } from "../metrics/period.util.js";
import { rowSession, toMetricsTrade, type TradeRow } from "../metrics/trade.mapper.js";
import { PrismaService } from "../prisma/prisma.service.js";

const PlaybookRuleSchema = z.object({
  order: z.coerce.number().int().min(0),
  text: z.string().trim().min(1).max(240)
});

const PlaybookCreateSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#3B82F6"),
  description: z.string().trim().max(1200).optional().nullable(),
  name: z.string().trim().min(1).max(120),
  rules: z.array(PlaybookRuleSchema).max(30).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([])
});

const PlaybookPatchSchema = PlaybookCreateSchema.partial().extend({
  isArchived: z.boolean().optional()
});

const TradePlaybookSchema = z.object({
  playbookId: z.string().nullable()
});

const PlaybookMetricsQuerySchema = MetricsQuerySchema.extend({
  accountId: z.string().optional()
});

type PlaybookCreateInput = z.infer<typeof PlaybookCreateSchema>;
type PlaybookPatchInput = z.infer<typeof PlaybookPatchSchema>;
type TradePlaybookInput = z.infer<typeof TradePlaybookSchema>;
type PlaybookMetricsQuery = z.infer<typeof PlaybookMetricsQuerySchema>;

function parseInput<T>(schema: ZodTypeAny, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: error.issues.map((issue) => ({ message: issue.message, path: issue.path.join(".") }))
      });
    }

    throw error;
  }
}

function serializeTrade(row: TradeRow & { playbook?: { color: string; id: string; name: string } | null }) {
  return {
    ...row,
    netProfit: row.grossProfit + row.commission + row.swap,
    playbook: row.playbook ?? null,
    session: rowSession(row)
  };
}

function rulesFrom(value: unknown) {
  return Array.isArray(value) ? value.filter((rule) => typeof rule === "object" && rule !== null) : [];
}

function checklistFrom(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is { checked: boolean; ruleIndex: number } =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { checked?: unknown }).checked === "boolean" &&
      Number.isInteger((item as { ruleIndex?: unknown }).ruleIndex)
  );
}

@Controller()
@UseGuards(AuthGuard)
export class PlaybooksController {
  constructor(private readonly prismaService: PrismaService) {}

  private async prisma() {
    return this.prismaService.client();
  }

  private async accountContext(userId: string, accountId?: string) {
    const prisma = await this.prisma();
    const accounts = (await prisma.tradingAccount.findMany({
      where: { ...(accountId ? { id: accountId } : {}), brokerConnection: { userId } },
      select: { id: true, startingBalance: true }
    })) as Array<{ id: string; startingBalance: number | null }>;
    if (accountId && accounts.length === 0) throw new ForbiddenException("Account not found or not yours");

    return {
      accountIds: accounts.map((account) => account.id),
      startingBalance: accounts.reduce((sum, account) => sum + (account.startingBalance ?? 0), 0)
    };
  }

  private async assertPlaybook(userId: string, playbookId: string) {
    const prisma = await this.prisma();
    const playbook = await prisma.playbook.findFirst({ where: { id: playbookId, userId } });
    if (!playbook) throw new ForbiddenException("Playbook not found or not yours");
    return playbook as {
      color: string;
      createdAt: Date;
      description: string | null;
      id: string;
      isArchived: boolean;
      name: string;
      rules: unknown;
      tags: string[];
      updatedAt: Date;
      userId: string;
    };
  }

  private async assertTrade(userId: string, tradeId: string) {
    const prisma = await this.prisma();
    const trade = await prisma.trade.findFirst({
      where: { id: tradeId, tradingAccount: { brokerConnection: { userId } } },
      select: { id: true, playbookId: true, tradingAccountId: true }
    });
    if (!trade) throw new ForbiddenException("Trade not found or not yours");
    return trade as { id: string; playbookId: string | null; tradingAccountId: string };
  }

  private async computeForPlaybook(userId: string, playbookId: string | null, query: PlaybookMetricsQuery) {
    const { accountIds, startingBalance } = await this.accountContext(userId, query.accountId);
    const { current, previous } = resolvePeriod(query.granularity, query.anchor, query.tz);
    const prisma = await this.prisma();
    const baseWhere = {
      tradingAccountId: { in: accountIds },
      playbookId,
      closeTime: { gte: previous.start, lt: current.end }
    };
    const rows = (await prisma.trade.findMany({
      where: baseWhere,
      orderBy: { closeTime: "asc" }
    })) as TradeRow[];
    const currentRows = rows.filter((row) => row.closeTime >= current.start && row.closeTime < current.end);
    const previousRows = rows.filter((row) => row.closeTime >= previous.start && row.closeTime < current.start);
    const metrics = computeMetrics({
      trades: currentRows.map(toMetricsTrade),
      previousTrades: previousRows.map(toMetricsTrade),
      equitySnapshots: [],
      startingBalance,
      timeZone: query.tz
    });

    return { current, currentRows, metrics, startingBalance };
  }

  private async computeRuleAdherence(userId: string, playbook: { id: string; rules: unknown }, currentRows: TradeRow[], startingBalance: number, timeZone?: string) {
    const ruleCount = rulesFrom(playbook.rules).length;
    const emptyMetrics = computeMetrics({ trades: [], equitySnapshots: [], startingBalance, timeZone });
    if (ruleCount === 0 || currentRows.length === 0) {
      return {
        adherencePct: null,
        brokenMetrics: emptyMetrics,
        brokenTrades: 0,
        configuredRules: ruleCount,
        delta: { expectancyR: null, netPnl: 0 },
        followedMetrics: emptyMetrics,
        followedTrades: 0,
        reviewedTrades: 0
      };
    }

    const prisma = await this.prisma();
    const tradeIds = currentRows.map((trade) => trade.id);
    const notes = (await prisma.tradeNote.findMany({
      where: { tradeId: { in: tradeIds }, trade: { tradingAccount: { brokerConnection: { userId } } } },
      orderBy: { updatedAt: "desc" },
      select: { playbookChecklist: true, tradeId: true }
    })) as Array<{ playbookChecklist: unknown; tradeId: string }>;
    const latestChecklistByTradeId = new Map<string, Array<{ checked: boolean; ruleIndex: number }>>();
    for (const note of notes) {
      if (!latestChecklistByTradeId.has(note.tradeId)) latestChecklistByTradeId.set(note.tradeId, checklistFrom(note.playbookChecklist));
    }

    const followedRows: TradeRow[] = [];
    const brokenRows: TradeRow[] = [];
    for (const row of currentRows) {
      const checklist = latestChecklistByTradeId.get(row.id);
      if (!checklist || checklist.length === 0) continue;
      const checkedRules = new Set(checklist.filter((item) => item.checked).map((item) => item.ruleIndex));
      const followed = Array.from({ length: ruleCount }, (_, index) => index).every((index) => checkedRules.has(index));
      if (followed) followedRows.push(row);
      else brokenRows.push(row);
    }

    const followedMetrics = computeMetrics({
      trades: followedRows.map(toMetricsTrade),
      equitySnapshots: [],
      startingBalance,
      timeZone
    });
    const brokenMetrics = computeMetrics({
      trades: brokenRows.map(toMetricsTrade),
      equitySnapshots: [],
      startingBalance,
      timeZone
    });
    const reviewedTrades = followedRows.length + brokenRows.length;

    return {
      adherencePct: reviewedTrades ? followedRows.length / reviewedTrades : null,
      brokenMetrics,
      brokenTrades: brokenRows.length,
      configuredRules: ruleCount,
      delta: {
        expectancyR:
          followedMetrics.expectancyR === null || brokenMetrics.expectancyR === null
            ? null
            : followedMetrics.expectancyR - brokenMetrics.expectancyR,
        netPnl: followedMetrics.netPnl - brokenMetrics.netPnl
      },
      followedMetrics,
      followedTrades: followedRows.length,
      reviewedTrades
    };
  }

  @Get("playbooks/performance-summary")
  async performanceSummary(@CurrentUser("id") userId: string, @Query() query: unknown) {
    const parsed = parseInput<PlaybookMetricsQuery>(PlaybookMetricsQuerySchema, query);
    const prisma = await this.prisma();
    const playbooks = (await prisma.playbook.findMany({
      where: { userId, isArchived: false },
      orderBy: [{ createdAt: "asc" }]
    })) as Array<{ color: string; id: string; name: string }>;

    const summaries = await Promise.all(
      playbooks.map(async (playbook) => {
        const { metrics } = await this.computeForPlaybook(userId, playbook.id, parsed);
        return { color: playbook.color, id: playbook.id, metrics, name: playbook.name };
      })
    );
    const { metrics: untaggedMetrics } = await this.computeForPlaybook(userId, null, parsed);

    return {
      playbooks: summaries,
      untagged: { metrics: untaggedMetrics }
    };
  }

  @Get("playbooks")
  async list(@CurrentUser("id") userId: string) {
    const prisma = await this.prisma();
    const playbooks = (await prisma.playbook.findMany({
      where: { userId },
      orderBy: [{ isArchived: "asc" }, { createdAt: "asc" }]
    })) as Array<Record<string, unknown> & { id: string }>;
    const counts = (await Promise.all(
      playbooks.map(async (playbook) => ({
        id: playbook.id,
        tradeCount: await prisma.trade.count({ where: { playbookId: playbook.id, tradingAccount: { brokerConnection: { userId } } } })
      }))
    )) as Array<{ id: string; tradeCount: number }>;
    const byId = new Map(counts.map((count) => [count.id, count.tradeCount]));

    return playbooks.map((playbook) => ({ ...playbook, tradeCount: byId.get(playbook.id) ?? 0 }));
  }

  @Post("playbooks")
  async create(@CurrentUser("id") userId: string, @Body() body: unknown) {
    const input = parseInput<PlaybookCreateInput>(PlaybookCreateSchema, body);
    const prisma = await this.prisma();
    return prisma.playbook.create({
      data: {
        color: input.color,
        description: input.description ?? null,
        name: input.name,
        rules: input.rules,
        tags: input.tags,
        userId
      }
    });
  }

  @Get("playbooks/:id")
  async detail(@CurrentUser("id") userId: string, @Param("id") playbookId: string) {
    const playbook = await this.assertPlaybook(userId, playbookId);
    const prisma = await this.prisma();
    const recentTrades = (await prisma.trade.findMany({
      where: { playbookId, tradingAccount: { brokerConnection: { userId } } },
      orderBy: { closeTime: "desc" },
      take: 8
    })) as TradeRow[];
    return {
      ...playbook,
      recentTrades: recentTrades.map((trade) => serializeTrade(trade))
    };
  }

  @Patch("playbooks/:id")
  async update(@CurrentUser("id") userId: string, @Param("id") playbookId: string, @Body() body: unknown) {
    await this.assertPlaybook(userId, playbookId);
    const input = parseInput<PlaybookPatchInput>(PlaybookPatchSchema, body);
    const prisma = await this.prisma();
    return prisma.playbook.update({
      where: { id: playbookId },
      data: {
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.rules !== undefined ? { rules: input.rules } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {})
      }
    });
  }

  @Delete("playbooks/:id")
  async archive(@CurrentUser("id") userId: string, @Param("id") playbookId: string) {
    await this.assertPlaybook(userId, playbookId);
    const prisma = await this.prisma();
    return prisma.playbook.update({ where: { id: playbookId }, data: { isArchived: true } });
  }

  @Get("playbooks/:id/performance")
  async performance(@CurrentUser("id") userId: string, @Param("id") playbookId: string, @Query() query: unknown) {
    const playbook = await this.assertPlaybook(userId, playbookId);
    const parsed = parseInput<PlaybookMetricsQuery>(PlaybookMetricsQuerySchema, query);
    const { current, currentRows, metrics, startingBalance } = await this.computeForPlaybook(userId, playbook.id, parsed);
    const ruleAdherence = await this.computeRuleAdherence(userId, playbook, currentRows, startingBalance, parsed.tz);
    const prisma = await this.prisma();
    const recentTrades = (await prisma.trade.findMany({
      where: {
        closeTime: { gte: current.start, lt: current.end },
        playbookId,
        ...(parsed.accountId ? { tradingAccountId: parsed.accountId } : {}),
        tradingAccount: { brokerConnection: { userId } }
      },
      orderBy: { closeTime: "desc" },
      take: 8
    })) as TradeRow[];

    return {
      metrics: metrics as MetricsResult,
      period: { label: current.label, granularity: parsed.granularity },
      playbook,
      recentTrades: recentTrades.map((trade) => serializeTrade(trade)),
      ruleAdherence
    };
  }

  @Patch("trades/:id/playbook")
  async tagTrade(@CurrentUser("id") userId: string, @Param("id") tradeId: string, @Body() body: unknown) {
    const input = parseInput<TradePlaybookInput>(TradePlaybookSchema, body);
    await this.assertTrade(userId, tradeId);
    if (input.playbookId) {
      const playbook = await this.assertPlaybook(userId, input.playbookId);
      if (playbook.isArchived) throw new BadRequestException("Archived playbooks cannot be assigned to trades");
    }

    const prisma = await this.prisma();
    const trade = (await prisma.trade.update({
      where: { id: tradeId },
      data: { playbookId: input.playbookId },
      include: { playbook: { select: { color: true, id: true, name: true } } }
    })) as TradeRow & { playbook?: { color: string; id: string; name: string } | null };

    return serializeTrade(trade);
  }
}

@Module({
  controllers: [PlaybooksController],
  providers: [PrismaService]
})
export class PlaybooksModule {}
