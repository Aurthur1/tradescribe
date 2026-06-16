import { z } from "zod";

export interface JournalEntryOutput {
  observed: string;
  inferred: string;
}

export interface WeeklyReviewOutput {
  summary: string;
  strengths: string[];
  prioritizedLeaks: Array<{
    type: string;
    severity: "info" | "warning" | "critical";
    explanation: string;
    evidenceTradeIds: string[];
  }>;
  nextActions: string[];
  coachProfileDelta: {
    newRecurringLeaks: string[];
    resolvedLeaks: string[];
    adviceGiven: string[];
  };
}

export const JournalEntrySchema: z.ZodType<JournalEntryOutput, z.ZodTypeDef, unknown> = z.object({
  observed: z.string().min(1),
  inferred: z.string().min(1)
});

export const WeeklyReviewSchema: z.ZodType<WeeklyReviewOutput, z.ZodTypeDef, unknown> = z.object({
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
