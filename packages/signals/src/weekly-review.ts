import type { LeakFlag } from "./types.js";
import { sortFlags } from "./detectors.js";

export interface WeeklyReviewLeakInput {
  leakFlags: LeakFlag[];
}

export function buildWeeklyReviewLeakSection(input: WeeklyReviewLeakInput) {
  return {
    leakFlags: sortFlags(input.leakFlags)
      .filter((flag) => flag.severity === "critical" || flag.severity === "warning")
      .map((flag) => ({
        evidence: flag.evidence,
        severity: flag.severity,
        tradeIds: flag.tradeIds,
        type: flag.type
      }))
  };
}

// TODO(segment-4): call buildWeeklyReviewLeakSection from the review.weekly job
// and pass the returned leakFlags into the structured LLM input.
