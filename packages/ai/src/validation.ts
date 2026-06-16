import type { WeeklyReviewOutput } from "./schemas.js";
import type { WeeklyReviewInput } from "./prompts/review.js";

const forbiddenCopy = /\b(guarantee|guaranteed|will profit|promise)\b/i;

export interface ReviewValidationResult {
  review: WeeklyReviewOutput;
  warnings: string[];
}

export function validateWeeklyReviewOutput(review: WeeklyReviewOutput, input: WeeklyReviewInput): ReviewValidationResult {
  const allowedTradeIds = new Set<string>();
  for (const trade of input.representativeTrades) allowedTradeIds.add(trade.id);
  for (const flag of input.leakFlags) {
    for (const id of flag.tradeIds) allowedTradeIds.add(id);
  }

  const warnings: string[] = [];
  const textBlocks = [
    review.summary,
    ...review.strengths,
    ...review.prioritizedLeaks.map((leak) => leak.explanation)
  ];
  if (textBlocks.some((text) => forbiddenCopy.test(text))) {
    throw new Error("Weekly review contained prohibited guarantee language");
  }

  const sanitized: WeeklyReviewOutput = {
    ...review,
    prioritizedLeaks: review.prioritizedLeaks.map((leak) => {
      const evidenceTradeIds = leak.evidenceTradeIds.filter((id) => {
        const valid = allowedTradeIds.has(id);
        if (!valid) warnings.push(`Stripped invalid evidence trade id ${id} from ${leak.type}`);
        return valid;
      });
      return { ...leak, evidenceTradeIds };
    }),
    coachProfileDelta: {
      ...review.coachProfileDelta,
      adviceGiven: review.coachProfileDelta.adviceGiven.length ? review.coachProfileDelta.adviceGiven : review.nextActions
    }
  };

  return { review: sanitized, warnings };
}
