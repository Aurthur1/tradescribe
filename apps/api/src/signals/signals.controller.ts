import { BadRequestException, Body, Controller, Get, Module, Param, Patch, Put, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";
import { GranularitySchema } from "../metrics/metrics.dto.js";
import { SignalsService } from "./signals.service.js";

const LeakStatusSchema = z.object({
  status: z.enum(["acknowledged", "dismissed"])
});

const LeakQuerySchema = z.object({
  anchor: z.string().datetime().optional(),
  granularity: GranularitySchema.default("week"),
  tz: z.string().default("UTC")
});

const PropRulesSchema = z.object({
  alertThresholdPct: z.number().gt(0).lte(1).default(0.8),
  consistencyMaxDailyProfitPct: z.number().gt(0).lte(1).optional(),
  maxDailyLossMode: z.enum(["balance", "equity"]).default("balance"),
  maxDailyLossPct: z.number().gt(0).lte(1).optional(),
  maxDrawdownMode: z.enum(["static", "trailing"]).default("static"),
  maxDrawdownPct: z.number().gt(0).lte(1).optional(),
  profitTargetPct: z.number().gt(0).lte(1).optional()
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException({
      message: "Validation failed",
      issues: result.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.join(".")
      }))
    });
  }
  return result.data;
}

@Controller()
@UseGuards(AuthGuard)
export class SignalsController {
  constructor(private readonly signals: SignalsService) {}

  @Get("accounts/:id/leaks")
  getLeaks(@CurrentUser("id") userId: string, @Param("id") accountId: string, @Query() query: unknown) {
    const parsed = parse(LeakQuerySchema, query);
    return this.signals.getLeaks(userId, accountId, {
      anchor: parsed.anchor,
      granularity: parsed.granularity ?? "week",
      tz: parsed.tz ?? "UTC"
    });
  }

  @Patch("leaks/:id")
  updateLeak(@CurrentUser("id") userId: string, @Param("id") leakId: string, @Body() body: unknown) {
    return this.signals.updateLeakStatus(userId, leakId, parse(LeakStatusSchema, body).status);
  }

  @Get("accounts/:id/guardrails")
  getGuardrails(@CurrentUser("id") userId: string, @Param("id") accountId: string, @Query("tz") tz?: string) {
    return this.signals.getGuardrails(userId, accountId, { tz });
  }

  @Get("accounts/:id/prop-rules")
  getPropRules(@CurrentUser("id") userId: string, @Param("id") accountId: string) {
    return this.signals.getPropRules(userId, accountId);
  }

  @Put("accounts/:id/prop-rules")
  putPropRules(@CurrentUser("id") userId: string, @Param("id") accountId: string, @Body() body: unknown) {
    const parsed = parse(PropRulesSchema, body);
    return this.signals.putPropRules(userId, accountId, {
      ...parsed,
      alertThresholdPct: parsed.alertThresholdPct ?? 0.8,
      maxDailyLossMode: parsed.maxDailyLossMode ?? "balance",
      maxDrawdownMode: parsed.maxDrawdownMode ?? "static"
    });
  }

  @Get("alerts")
  getAlerts(@CurrentUser("id") userId: string, @Query("unreadOnly") unreadOnly?: string) {
    return this.signals.getAlerts(userId, unreadOnly === "true");
  }

  @Patch("alerts/:id/read")
  markAlertRead(@CurrentUser("id") userId: string, @Param("id") alertId: string) {
    return this.signals.markAlertRead(userId, alertId);
  }
}

@Module({
  controllers: [SignalsController],
  providers: [SignalsService, PrismaService, RedisService]
})
export class SignalsModule {}
