import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AnthropicProvider,
  JournalEntrySchema,
  OpenAIProvider,
  WeeklyReviewSchema,
  selectRepresentativeTrades,
  validateWeeklyReviewOutput
} from "../dist/index.js";

function response(payload) {
  return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" }, status: 200 });
}

describe("provider structured contract", () => {
  it("parses Anthropic text output through the same schema boundary", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    const provider = new AnthropicProvider(async () =>
      response({
        content: [{ type: "text", text: JSON.stringify({ observed: "Observed EURUSD BUY.", inferred: "This may suggest planned execution." }) }],
        usage: { input_tokens: 10, output_tokens: 12 }
      })
    );
    const result = await provider.generateStructured({
      maxTokens: 200,
      messages: [{ role: "user", content: "test" }],
      schema: JournalEntrySchema,
      system: "test"
    });
    assert.equal(result.data.observed, "Observed EURUSD BUY.");
    assert.equal(result.tokensUsed, 22);
  });

  it("parses OpenAI text output through the same schema boundary", async () => {
    process.env.OPENAI_API_KEY = "test";
    const provider = new OpenAIProvider(async () =>
      response({
        choices: [{ message: { content: JSON.stringify({ observed: "Observed GBPUSD SELL.", inferred: "Consider whether patience improved the entry." }) } }],
        usage: { prompt_tokens: 5, completion_tokens: 7 }
      })
    );
    const result = await provider.generateStructured({
      maxTokens: 200,
      messages: [{ role: "user", content: "test" }],
      schema: JournalEntrySchema,
      system: "test"
    });
    assert.equal(result.data.inferred, "Consider whether patience improved the entry.");
    assert.equal(result.tokensUsed, 12);
  });
});

describe("representative trade selection", () => {
  it("prioritizes critical and warning leak trades before period spread", () => {
    const trades = Array.from({ length: 10 }, (_, index) => ({
      closeTime: `2025-04-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
      id: `T${index + 1}`,
      netProfit: index === 2 ? 500 : index === 8 ? -300 : index
    }));
    const selected = selectRepresentativeTrades(
      trades,
      [
        { evidence: {}, id: "L1", severity: "warning", tradeIds: ["T4"], type: "overtrading" },
        { evidence: {}, id: "L2", severity: "critical", tradeIds: ["T9"], type: "revenge_trade" }
      ],
      4
    );
    assert.deepEqual(selected.slice(0, 2).map((trade) => trade.id), ["T9", "T4"]);
    assert.equal(selected.some((trade) => trade.id === "T3"), true);
  });
});

describe("weekly review validation", () => {
  const input = {
    coachProfile: { adviceLog: [], goals: [], recurringLeaks: {} },
    leakFlags: [{ evidence: {}, id: "L1", severity: "critical", tradeIds: ["T1"], type: "revenge_trade" }],
    metrics: {},
    period: { end: "2025-04-12", label: "Week", start: "2025-04-06" },
    representativeTrades: [{ closeTime: "2025-04-07T10:00:00Z", id: "T2", netProfit: 10, side: "BUY", symbol: "EURUSD" }]
  };

  it("strips invalid evidence ids without failing the whole review", () => {
    const parsed = WeeklyReviewSchema.parse({
      coachProfileDelta: { adviceGiven: ["Do this"], newRecurringLeaks: ["revenge_trade"], resolvedLeaks: [] },
      nextActions: ["Do this"],
      prioritizedLeaks: [{ evidenceTradeIds: ["T1", "missing"], explanation: "Reviewed T1.", severity: "critical", type: "revenge_trade" }],
      strengths: ["Good records"],
      summary: "The week had reviewable structure."
    });
    const result = validateWeeklyReviewOutput(parsed, input);
    assert.deepEqual(result.review.prioritizedLeaks[0].evidenceTradeIds, ["T1"]);
    assert.equal(result.warnings.length, 1);
  });

  it("rejects guarantee language as a hard compliance gate", () => {
    const parsed = WeeklyReviewSchema.parse({
      coachProfileDelta: { adviceGiven: ["Do this"], newRecurringLeaks: [], resolvedLeaks: [] },
      nextActions: ["Do this"],
      prioritizedLeaks: [],
      strengths: ["Good records"],
      summary: "This will profit next week."
    });
    assert.throws(() => validateWeeklyReviewOutput(parsed, input), /prohibited/);
  });
});
