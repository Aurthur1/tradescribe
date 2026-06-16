import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectAsymmetricWinLoss,
  detectCorrelatedCluster,
  detectExcessiveSingleTradeRisk,
  detectLeaks,
  detectMissingStopLoss,
  detectOvertrading,
  detectRevengeTrade,
  detectRiskInconsistency,
  detectStopWidened,
  evaluateGuardrails
} from "../dist/index.js";

function trade(input) {
  return {
    closePrice: 1.1,
    closeTime: "2025-04-07T10:00:00Z",
    commission: 0,
    grossProfit: 100,
    id: "T",
    openPrice: 1.1,
    openTime: "2025-04-07T09:00:00Z",
    side: "BUY",
    stopLoss: 1,
    swap: 0,
    symbol: "EURUSD",
    volume: 1,
    ...input
  };
}

describe("leak detectors", () => {
  it("detects revenge trades with boundary semantics", () => {
    const boundary = [
      trade({ closeTime: "2025-04-07T09:00:00Z", grossProfit: -100, id: "L", openTime: "2025-04-07T08:00:00Z", volume: 1 }),
      trade({ grossProfit: 50, id: "N", openTime: "2025-04-07T09:15:00Z", volume: 1.49 })
    ];
    assert.equal(detectRevengeTrade(boundary).length, 0);
    assert.equal(detectRevengeTrade([boundary[0], { ...boundary[1], volume: 1.5 }]).length, 1);
    assert.equal(detectRevengeTrade([boundary[0], { ...boundary[1], volume: 2 }])[0].severity, "critical");
  });

  it("detects overtrading only above threshold", () => {
    const baseline = Array.from({ length: 10 }, (_, day) => trade({ id: `B${day}`, closeTime: `2025-03-${String(day + 1).padStart(2, "0")}T10:00:00Z` }));
    const nearMiss = Array.from({ length: 2 }, (_, index) => trade({ id: `N${index}`, closeTime: "2025-04-07T10:00:00Z" }));
    assert.equal(detectOvertrading(nearMiss, baseline, [], { overtradeRatio: 2 }).length, 0);
    const trigger = [...nearMiss, trade({ id: "N3", closeTime: "2025-04-07T11:00:00Z" })];
    assert.equal(detectOvertrading(trigger, baseline, [], { overtradeRatio: 2 }).length, 1);
  });

  it("detects missing stop and critical fallback only with equity", () => {
    const missing = trade({ grossProfit: -300, id: "M", stopLoss: null });
    assert.equal(detectMissingStopLoss([missing])[0].severity, "warning");
    assert.equal(detectMissingStopLoss([missing], [{ ts: "2025-04-07T08:00:00Z", equity: 10000, balance: 10000 }])[0].severity, "critical");
  });

  it("detects stop widening and unavailable history returns empty", () => {
    assert.equal(detectStopWidened().length, 0);
    assert.equal(detectStopWidened([{ final: 0.98, openPrice: 1.1, original: 1, side: "BUY", tradeId: "S" }]).length, 1);
    assert.equal(detectStopWidened([{ final: 1, openPrice: 1.1, original: 1, side: "BUY", tradeId: "B" }]).length, 0);
  });

  it("detects risk inconsistency only above CV threshold", () => {
    const steady = [100, 100, 100, 100, 100].map((risk, index) => trade({ id: `R${index}`, riskAmount: risk }));
    assert.equal(detectRiskInconsistency(steady).length, 0);
    const uneven = [10, 10, 10, 10, 100].map((risk, index) => trade({ id: `U${index}`, riskAmount: risk }));
    assert.equal(detectRiskInconsistency(uneven).length, 1);
  });

  it("detects asymmetric win/loss only when winners are smaller in R", () => {
    assert.equal(
      detectAsymmetricWinLoss([
        trade({ grossProfit: 100, id: "W", riskAmount: 100 }),
        trade({ grossProfit: -100, id: "L", riskAmount: 100 })
      ]).length,
      0
    );
    assert.equal(
      detectAsymmetricWinLoss([
        trade({ grossProfit: 50, id: "W", riskAmount: 100 }),
        trade({ grossProfit: -120, id: "L", riskAmount: 100 })
      ]).length,
      1
    );
  });

  it("detects correlated overlapping same-direction clusters", () => {
    const flags = detectCorrelatedCluster([
      trade({ id: "C1", openTime: "2025-04-07T09:00:00Z", closeTime: "2025-04-07T11:00:00Z", symbol: "EURUSD", side: "BUY" }),
      trade({ id: "C2", openTime: "2025-04-07T10:00:00Z", closeTime: "2025-04-07T12:00:00Z", symbol: "GBPUSD", side: "BUY" }),
      trade({ id: "C3", openTime: "2025-04-07T10:00:00Z", closeTime: "2025-04-07T12:00:00Z", symbol: "AUDUSD", side: "SELL" })
    ]);
    assert.equal(flags.length, 1);
  });

  it("detects excessive single-trade risk just over threshold", () => {
    const exact = trade({ id: "E", riskAmount: 200 });
    const over = trade({ id: "O", riskAmount: 201 });
    const snapshots = [{ ts: "2025-04-07T08:00:00Z", equity: 10000, balance: 10000 }];
    assert.equal(detectExcessiveSingleTradeRisk([exact], snapshots, 10000).length, 0);
    assert.equal(detectExcessiveSingleTradeRisk([over], snapshots, 10000).length, 1);
  });

  it("aggregates and sorts critical flags first", () => {
    const flags = detectLeaks({
      accountEquitySnapshots: [{ ts: "2025-04-07T08:00:00Z", equity: 10000, balance: 10000 }],
      startingBalance: 10000,
      trades: [trade({ grossProfit: -300, id: "A", riskAmount: 600, stopLoss: null })]
    });
    assert.equal(flags[0].severity, "critical");
  });
});

describe("guardrails", () => {
  const rules = {
    alertThresholdPct: 0.8,
    maxDailyLossMode: "equity",
    maxDailyLossPct: 0.05,
    maxDrawdownMode: "static",
    maxDrawdownPct: 0.1,
    profitTargetPct: 0.08,
    startingBalance: 10000
  };

  it("computes ok, warning, and breached daily loss", () => {
    assert.equal(evaluateGuardrails([{ ts: "2025-04-07T08:00:00Z", equity: 10000, balance: 10000 }], [], rules, new Date("2025-04-07T10:00:00Z")).dailyLoss.status, "ok");
    assert.equal(evaluateGuardrails([{ ts: "2025-04-07T08:00:00Z", equity: 10000, balance: 10000 }, { ts: "2025-04-07T10:00:00Z", equity: 9600, balance: 10000 }], [], rules, new Date("2025-04-07T10:00:00Z")).dailyLoss.status, "warning");
    assert.equal(evaluateGuardrails([{ ts: "2025-04-07T08:00:00Z", equity: 10000, balance: 10000 }, { ts: "2025-04-07T10:00:00Z", equity: 9500, balance: 10000 }], [], rules, new Date("2025-04-07T10:00:00Z")).dailyLoss.status, "breached");
  });

  it("computes drawdown, profit target, and consistency edge", () => {
    const status = evaluateGuardrails([{ ts: "2025-04-07T10:00:00Z", equity: 10800, balance: 10800 }], [], rules, new Date("2025-04-07T10:00:00Z"));
    assert.equal(status.profitTarget.status, "reached");
    assert.equal(status.consistency, undefined);
    const breached = evaluateGuardrails([{ ts: "2025-04-07T10:00:00Z", equity: 9000, balance: 9000 }], [], rules, new Date("2025-04-07T10:00:00Z"));
    assert.equal(breached.drawdown.status, "breached");
  });
});
