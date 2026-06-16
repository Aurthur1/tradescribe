import { z } from "zod";

export const JournalEntrySchema = z.object({
  observed: z.string().min(1),
  inferred: z.string().min(1)
});

export const WeeklyReviewSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.string().min(1)).max(5),
  prioritizedLeaks: z
    .array(
      z.object({
        type: z.string().min(1),
        severity: z.enum(["info", "warning", "critical"]),
        explanation: z.string().min(1),
        evidenceTradeIds: z.array(z.string())
      })
    )
    .max(8),
  nextActions: z.array(z.string().min(1)).min(1).max(3),
  coachProfileDelta: z.object({
    newRecurringLeaks: z.array(z.string()).default([]),
    resolvedLeaks: z.array(z.string()).default([]),
    adviceGiven: z.array(z.string())
  })
});

export type JournalEntryOutput = z.infer<typeof JournalEntrySchema>;
export type WeeklyReviewOutput = z.infer<typeof WeeklyReviewSchema>;
