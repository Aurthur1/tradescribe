import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { detectLeaks, evaluateGuardrails, type GuardrailStatus, type PropFirmRules } from "@tradescribe/signals";
import { PrismaService } from "../prisma/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";
import { resolvePeriod, type Granularity } from "../metrics/period.util.js";
import { toMetricsTrade, type TradeRow } from "../metrics/trade.mapper.js";
import { createAlertEmailSender } from "./alert-email.sender.js";

const GUARDRAIL_CACHE_TTL_SECONDS = 60;

interface AccountOwnership {
  id: string;
  currency: string;
  startingBalance: number | null;
  brokerConnection: { userId: string; user: { email?: string | null } };
}

interface RuleRow {
  alertThresholdPct: number;
  consistencyMaxDailyProfitPct: number | null;
  maxDailyLossMode: "balance" | "equity";
  maxDailyLossPct: number | null;
  maxDrawdownMode: "static" | "trailing";
  maxDrawdownPct: number | null;
  profitTargetPct: number | null;
}

@Injectable()
export class SignalsService {
  private readonly emailSender = createAlertEmailSender();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redis: RedisService
  ) {}

  private async assertOwnership(userId: string, accountId: string): Promise<AccountOwnership> {
    const prisma = await this.prismaService.client();
    const account = (await prisma.tradingAccount.findFirst({
      where: { id: accountId, brokerConnection: { userId } },
      include: { brokerConnection: { include: { user: true } } }
    })) as AccountOwnership | null;

    if (!account) throw new ForbiddenException("Account not found or not yours");
    return account;
  }

  async getLeaks(userId: string, accountId: string, query: { granularity: Granularity; anchor?: string; tz: string }) {
    await this.assertOwnership(userId, accountId);
    const prisma = await this.prismaService.client();
    const { current } = resolvePeriod(query.granularity, query.anchor, query.tz);
    const existing = await prisma.leakFlag.findMany({
      where: {
        tradingAccountId: accountId,
        createdAt: { gte: current.start, lt: current.end }
      },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }]
    });

    if ((existing as unknown[]).length > 0) return existing;

    const rows = (await prisma.trade.findMany({
      where: { tradingAccountId: accountId, closeTime: { gte: current.start, lt: current.end } },
      orderBy: { openTime: "asc" }
    })) as TradeRow[];
    return detectLeaks({ trades: rows.map(toMetricsTrade), config: { timeZone: query.tz } }).map((flag) => ({
      id: `computed-${flag.type}-${flag.tradeIds.join("-") || (flag.periodStart ?? "period")}`,
      ...flag,
      status: "active",
      createdAt: new Date().toISOString()
    }));
  }

  async updateLeakStatus(userId: string, leakId: string, status: "acknowledged" | "dismissed") {
    const prisma = await this.prismaService.client();
    const leak = (await prisma.leakFlag.findFirst({
      where: { id: leakId, tradingAccount: { brokerConnection: { userId } } }
    })) as { id: string } | null;
    if (!leak) throw new NotFoundException("Leak flag not found");
    return prisma.leakFlag.update({ where: { id: leakId }, data: { status } });
  }

  async getPropRules(userId: string, accountId: string) {
    await this.assertOwnership(userId, accountId);
    const prisma = await this.prismaService.client();
    return prisma.propFirmRuleSet.findUnique({ where: { tradingAccountId: accountId } });
  }

  async putPropRules(userId: string, accountId: string, body: Omit<PropFirmRules, "startingBalance">) {
    await this.assertOwnership(userId, accountId);
    const prisma = await this.prismaService.client();
    return prisma.propFirmRuleSet.upsert({
      create: { ...body, tradingAccountId: accountId },
      update: body,
      where: { tradingAccountId: accountId }
    });
  }

  async getGuardrails(userId: string, accountId: string, query: { tz?: string }): Promise<GuardrailStatus | null> {
    const account = await this.assertOwnership(userId, accountId);
    const prisma = await this.prismaService.client();
    const cacheKey = `guardrails:${accountId}:${query.tz ?? "UTC"}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as GuardrailStatus | null;

    const rule = (await prisma.propFirmRuleSet.findUnique({ where: { tradingAccountId: accountId } })) as RuleRow | null;
    if (!rule) {
      await this.redis.set(cacheKey, JSON.stringify(null), "EX", GUARDRAIL_CACHE_TTL_SECONDS);
      return null;
    }

    const [trades, snapshots] = (await prisma.$transaction([
      prisma.trade.findMany({ where: { tradingAccountId: accountId }, orderBy: { closeTime: "asc" } }),
      prisma.equitySnapshot.findMany({ where: { tradingAccountId: accountId }, orderBy: { ts: "asc" } })
    ])) as [TradeRow[], Array<{ ts: Date; equity: number; balance: number }>];

    const status = evaluateGuardrails(
      snapshots,
      trades.map(toMetricsTrade),
      {
        alertThresholdPct: rule.alertThresholdPct,
        consistencyMaxDailyProfitPct: rule.consistencyMaxDailyProfitPct ?? undefined,
        maxDailyLossMode: rule.maxDailyLossMode,
        maxDailyLossPct: rule.maxDailyLossPct ?? undefined,
        maxDrawdownMode: rule.maxDrawdownMode,
        maxDrawdownPct: rule.maxDrawdownPct ?? undefined,
        profitTargetPct: rule.profitTargetPct ?? undefined,
        startingBalance: account.startingBalance ?? 0
      },
      new Date(),
      query.tz ?? "UTC"
    );
    await this.redis.set(cacheKey, JSON.stringify(status), "EX", GUARDRAIL_CACHE_TTL_SECONDS);
    return status;
  }

  async getAlerts(userId: string, unreadOnly?: boolean) {
    const prisma = await this.prismaService.client();
    return prisma.alert.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  async markAlertRead(userId: string, alertId: string) {
    const prisma = await this.prismaService.client();
    const alert = (await prisma.alert.findFirst({ where: { id: alertId, userId } })) as { id: string } | null;
    if (!alert) throw new NotFoundException("Alert not found");
    return prisma.alert.update({ where: { id: alertId }, data: { readAt: new Date() } });
  }

  async createAlert(input: { userId: string; email?: string | null; tradingAccountId?: string; type: string; severity: string; payload: unknown }) {
    const prisma = await this.prismaService.client();
    const alert = await prisma.alert.create({
      data: {
        channel: "in_app",
        payload: input.payload,
        severity: input.severity,
        tradingAccountId: input.tradingAccountId,
        type: input.type,
        userId: input.userId
      }
    });
    await this.emailSender.send({ email: input.email ?? undefined, payload: input.payload, severity: input.severity, type: input.type });
    return alert;
  }
}
