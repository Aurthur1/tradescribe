import { z } from 'zod';

export const GranularitySchema = z.enum(['day', 'week', 'month', 'year']);

export const MetricsQuerySchema = z.object({
  granularity: GranularitySchema.default('week'),
  /** Anchor date (ISO). Defaults to "now" server-side. */
  anchor: z.string().datetime().optional(),
  /** IANA time zone for bucketing and period boundaries. */
  tz: z.string().default('UTC'),
  /** Optional filters that also constrain the metrics. */
  symbol: z.string().optional(),
  session: z.enum(['Sydney', 'Tokyo', 'London', 'New York']).optional(),
  side: z.enum(['BUY', 'SELL']).optional(),
});
export type MetricsQuery = z.infer<typeof MetricsQuerySchema>;

export const TradesQuerySchema = MetricsQuerySchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.enum(['closeTime', 'netProfit', 'symbol', 'volume']).default('closeTime'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type TradesQuery = z.infer<typeof TradesQuerySchema>;
