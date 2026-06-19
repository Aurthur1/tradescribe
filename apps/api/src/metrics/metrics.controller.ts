import { BadRequestException, Body, Controller, Get, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { z, ZodError, type ZodTypeAny } from "zod";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";
import { MetricsQuerySchema, TradesQuerySchema, type MetricsQuery, type TradesQuery } from "./metrics.dto.js";
import { MetricsService } from "./metrics.service.js";

const TradeNoteSchema = z.object({
  body: z.string().max(10000).default(""),
  emotionTags: z.array(z.string().max(40)).max(20).default([]),
  playbookChecklist: z.array(z.object({ checked: z.boolean(), ruleIndex: z.number().int().min(0) })).max(50).optional()
});

const ScreenshotSchema = z.object({
  filename: z.string().max(255).optional(),
  mimeType: z.string().max(120).optional(),
  storageKey: z.string().max(500).optional(),
  url: z.string().max(2_000_000)
});

const ScreenshotSignSchema = z.object({
  filename: z.string().max(255),
  mimeType: z.string().max(120)
});

const BulkPlaybookSchema = z.object({
  playbookId: z.string().nullable(),
  tradeIds: z.array(z.string()).min(1).max(10000)
});

const BulkEmotionSchema = z.object({
  emotionTag: z.string().trim().min(1).max(40),
  tradeIds: z.array(z.string()).min(1).max(10000)
});

type TradeNoteInput = z.infer<typeof TradeNoteSchema>;
type ScreenshotInput = z.infer<typeof ScreenshotSchema>;
type ScreenshotSignInput = z.infer<typeof ScreenshotSignSchema>;
type BulkPlaybookInput = z.infer<typeof BulkPlaybookSchema>;
type BulkEmotionInput = z.infer<typeof BulkEmotionSchema>;

function parseQuery<T>(schema: ZodTypeAny, query: unknown): T {
  try {
    return schema.parse(query);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    throw error;
  }
}

@Controller()
@UseGuards(AuthGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get("accounts/:id/metrics")
  getMetrics(@CurrentUser("id") userId: string, @Param("id") accountId: string, @Query() query: unknown) {
    return this.metrics.getMetrics(userId, accountId, parseQuery<MetricsQuery>(MetricsQuerySchema, query));
  }

  @Get("accounts/:id/trades")
  getTrades(@CurrentUser("id") userId: string, @Param("id") accountId: string, @Query() query: unknown) {
    return this.metrics.getTrades(userId, accountId, parseQuery<TradesQuery>(TradesQuerySchema, query));
  }

  @Get("trades/:id")
  getTrade(@CurrentUser("id") userId: string, @Param("id") tradeId: string) {
    return this.metrics.getTrade(userId, tradeId);
  }

  @Post("trades/:id/notes")
  saveTradeNote(@CurrentUser("id") userId: string, @Param("id") tradeId: string, @Body() body: unknown) {
    return this.metrics.saveTradeNote(userId, tradeId, parseQuery<TradeNoteInput>(TradeNoteSchema, body));
  }

  @Post("trades/:id/screenshots")
  addScreenshot(@CurrentUser("id") userId: string, @Param("id") tradeId: string, @Body() body: unknown) {
    return this.metrics.addTradeScreenshot(userId, tradeId, parseQuery<ScreenshotInput>(ScreenshotSchema, body));
  }

  @Post("trades/:id/screenshots/sign")
  createScreenshotUpload(@CurrentUser("id") userId: string, @Param("id") tradeId: string, @Body() body: unknown) {
    return this.metrics.createScreenshotUpload(userId, tradeId, parseQuery<ScreenshotSignInput>(ScreenshotSignSchema, body));
  }

  @Patch("trades/bulk/playbook")
  bulkPlaybook(@CurrentUser("id") userId: string, @Body() body: unknown) {
    return this.metrics.bulkSetPlaybook(userId, parseQuery<BulkPlaybookInput>(BulkPlaybookSchema, body));
  }

  @Patch("trades/bulk/emotion")
  bulkEmotion(@CurrentUser("id") userId: string, @Body() body: unknown) {
    return this.metrics.bulkAddEmotion(userId, parseQuery<BulkEmotionInput>(BulkEmotionSchema, body));
  }
}

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, PrismaService, RedisService]
})
export class MetricsModule {}
