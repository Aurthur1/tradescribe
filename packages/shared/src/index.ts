import { z } from "zod";

export const APP_NAME = "TradeScribe";

export const QUEUES = {
  maintenance: "maintenance",
  connectionBackfill: "connection.backfill",
  connectionSync: "connection.sync",
  metricsRecompute: "metrics.recompute",
  weeklyReview: "review.weekly"
} as const;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  ts: z.string().datetime()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const tradeSideSchema = z.enum(["BUY", "SELL"]);
export type TradeSide = z.infer<typeof tradeSideSchema>;

export const tradingPlatformSchema = z.enum(["MT4", "MT5"]);
export type TradingPlatform = z.infer<typeof tradingPlatformSchema>;
