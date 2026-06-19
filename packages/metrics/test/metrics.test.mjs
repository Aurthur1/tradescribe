import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifySession,
  computeByDayOfWeek,
  computeByWeekday,
  computeCoreMetrics,
  computeDailySeries,
  computeMetrics,
  maxDrawdown,
  rMultipleHistogram
} from "../dist/index.js";

function expectClose(actual, expected, precision = 10) {
  const tolerance = 10 ** -precision;
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not close to ${expected}`);
}

function trade(input) {
  return {
    symbol: "EURUSD",
    side: "BUY",
    openTime: "2025-04-07T08:00:00Z",
    closeTime: "2025-04-07T09:00:00Z",
    openPrice: 1.1,
    closePrice: 1.1,
    volume: 1,
    commission: 0,
    swap: 0,
    stopLoss: null,
    durationSec: 3600,
    ...input
  };
}

const mixed = [
  trade({
    id: "T1",
    grossProfit: 100,
    riskAmount: 50,
    openTime: "2025-04-07T08:00:00Z",
    closeTime: "2025-04-07T09:00:00Z",
    durationSec: 3600
  }),
  trade({
    id: "T2",
    grossProfit: -50,
    riskAmount: 50,
    openTime: "2025-04-07T02:00:00Z",
    closeTime: "2025-04-07T03:00:00Z",
    durationSec: 1800
  }),
  trade({
    id: "T3",
    grossProfit: 200,
    riskAmount: 100,
    symbol: "GBPUSD",
    openTime: "2025-04-08T13:00:00Z",
    closeTime: "2025-04-08T14:00:00Z",
    durationSec: 7200
  }),
  trade({
    id: "T4",
    grossProfit: -50,
    riskAmount: 50,
    openTime: "2025-04-08T23:00:00Z",
    closeTime: "2025-04-08T23:30:00Z",
    durationSec: 1800
  })
];

describe("core metrics", () => {
  const metrics = computeCoreMetrics(mixed);

  it("counts and P&L", () => {
    assert.equal(metrics.totalTrades, 4);
    assert.equal(metrics.totalVolume, 4);
    assert.equal(metrics.winningTrades, 2);
    assert.equal(metrics.losingTrades, 2);
    assert.equal(metrics.netPnl, 200);
    assert.equal(metrics.grossWin, 300);
    assert.equal(metrics.grossLoss, -100);
  });

  it("rates and averages", () => {
    expectClose(metrics.winRate, 0.5);
    assert.equal(metrics.avgWin, 150);
    assert.equal(metrics.avgLoss, -50);
    assert.equal(metrics.profitFactor, 3);
    assert.equal(metrics.profitFactorReason, null);
    expectClose(metrics.expectancyCurrency, 50);
  });

  it("R-multiple stats", () => {
    expectClose(metrics.avgWinR, 2);
    expectClose(metrics.avgLossR, -1);
    expectClose(metrics.expectancyR, 0.5);
  });

  it("average hold", () => {
    assert.equal(metrics.avgHoldSeconds, 3600);
  });

  it("largest wins/losses and streaks are part of the core contract", () => {
    assert.equal(metrics.largestWin, 200);
    assert.equal(metrics.largestLoss, -50);
    assert.deepEqual(metrics.currentStreak, { type: "loss", count: 1 });
    assert.equal(metrics.longestWinStreak, 2);
    assert.equal(metrics.longestLossStreak, 1);
  });
});

describe("edge cases", () => {
  it("handles an empty set", () => {
    const metrics = computeCoreMetrics([]);
    assert.equal(metrics.totalTrades, 0);
    assert.equal(metrics.totalVolume, 0);
    assert.equal(metrics.netPnl, 0);
    assert.equal(metrics.winRate, 0);
    assert.equal(metrics.profitFactor, null);
    assert.equal(metrics.profitFactorReason, "no_trades");
    assert.equal(metrics.expectancyR, null);
    assert.deepEqual(metrics.currentStreak, { type: null, count: 0 });
    assert.equal(metrics.largestWin, 0);
    assert.equal(metrics.largestLoss, 0);
  });

  it("handles all wins as undefined profit factor with no_losses reason", () => {
    const metrics = computeCoreMetrics([
      trade({ id: "W1", grossProfit: 100 }),
      trade({ id: "W2", grossProfit: 50 })
    ]);
    assert.equal(metrics.profitFactor, null);
    assert.equal(metrics.profitFactorReason, "no_losses");
    assert.equal(metrics.winRate, 1);
    assert.equal(metrics.avgLoss, 0);
    expectClose(metrics.expectancyCurrency, 75);
  });

  it("handles all losses with zero profit factor", () => {
    const metrics = computeCoreMetrics([
      trade({ id: "L1", grossProfit: -100 }),
      trade({ id: "L2", grossProfit: -50 })
    ]);
    assert.equal(metrics.profitFactor, 0);
    assert.equal(metrics.profitFactorReason, null);
    assert.equal(metrics.winRate, 0);
    expectClose(metrics.expectancyCurrency, -75);
  });

  it("returns null R stats when no stop loss exists", () => {
    const metrics = computeCoreMetrics([
      trade({ id: "N1", grossProfit: 100 }),
      trade({ id: "N2", grossProfit: -40 })
    ]);
    assert.equal(metrics.avgWinR, null);
    assert.equal(metrics.avgLossR, null);
    assert.equal(metrics.expectancyR, null);
  });

  it("folds commission and swap into net", () => {
    const metrics = computeCoreMetrics([
      trade({ id: "C1", grossProfit: 100, commission: -7, swap: -3 })
    ]);
    assert.equal(metrics.netPnl, 90);
    assert.equal(metrics.winningTrades, 1);
  });
});

describe("streaks", () => {
  it("handles a single trade as the current streak", () => {
    const metrics = computeCoreMetrics([trade({ id: "S1", grossProfit: 10, closeTime: "2025-04-07T10:00:00Z" })]);
    assert.deepEqual(metrics.currentStreak, { type: "win", count: 1 });
    assert.equal(metrics.longestWinStreak, 1);
    assert.equal(metrics.longestLossStreak, 0);
  });

  it("starts current streak from the most recent outcome and breakeven interrupts it", () => {
    const metrics = computeCoreMetrics([
      trade({ id: "S1", grossProfit: 100, closeTime: "2025-04-07T10:00:00Z" }),
      trade({ id: "S2", grossProfit: 0, closeTime: "2025-04-07T11:00:00Z" }),
      trade({ id: "S3", grossProfit: -20, closeTime: "2025-04-07T12:00:00Z" }),
      trade({ id: "S4", grossProfit: -10, closeTime: "2025-04-07T13:00:00Z" })
    ]);
    assert.deepEqual(metrics.currentStreak, { type: "loss", count: 2 });
    assert.equal(metrics.longestWinStreak, 1);
    assert.equal(metrics.longestLossStreak, 2);
  });

  it("breakeven splits longest win and loss streaks", () => {
    const metrics = computeCoreMetrics([
      trade({ id: "L1", grossProfit: 25, closeTime: "2025-04-07T10:00:00Z" }),
      trade({ id: "L2", grossProfit: 35, closeTime: "2025-04-07T11:00:00Z" }),
      trade({ id: "BE", grossProfit: 0, closeTime: "2025-04-07T12:00:00Z" }),
      trade({ id: "L3", grossProfit: 45, closeTime: "2025-04-07T13:00:00Z" }),
      trade({ id: "L4", grossProfit: -15, closeTime: "2025-04-07T14:00:00Z" }),
      trade({ id: "L5", grossProfit: -20, closeTime: "2025-04-07T15:00:00Z" })
    ]);
    assert.equal(metrics.longestWinStreak, 2);
    assert.equal(metrics.longestLossStreak, 2);
  });
});

describe("session classification", () => {
  const at = (hour) => `2025-04-07T${String(hour).padStart(2, "0")}:00:00Z`;

  it("classifies representative hours", () => {
    assert.equal(classifySession(at(8)), "London");
    assert.equal(classifySession(at(13)), "London");
    assert.equal(classifySession(at(18)), "New York");
    assert.equal(classifySession(at(2)), "Tokyo");
    assert.equal(classifySession(at(5)), "Tokyo");
    assert.equal(classifySession(at(23)), "Sydney");
    assert.equal(classifySession(at(0)), "Tokyo");
  });
});

describe("daily series and time zones", () => {
  it("buckets by close date with cumulative totals", () => {
    assert.deepEqual(computeDailySeries(mixed, "UTC"), [
      { breakevenTrades: 0, date: "2025-04-07", losingTrades: 1, netPnl: 50, rMultipleSum: 1, tradeCount: 2, winRate: 0.5, winningTrades: 1, cumulativePnl: 50 },
      { breakevenTrades: 0, date: "2025-04-08", losingTrades: 1, netPnl: 150, rMultipleSum: 1, tradeCount: 2, winRate: 0.5, winningTrades: 1, cumulativePnl: 200 }
    ]);
  });

  it("respects the requested time zone", () => {
    const trades = [trade({ id: "Z1", grossProfit: 10, closeTime: "2025-04-08T01:00:00Z" })];
    assert.equal(computeDailySeries(trades, "UTC")[0].date, "2025-04-08");
    assert.equal(computeDailySeries(trades, "America/New_York")[0].date, "2025-04-07");
  });
});

describe("drawdown", () => {
  it("finds max peak-to-trough", () => {
    const drawdown = maxDrawdown([1000, 950, 1050, 1250, 1200]);
    assert.equal(drawdown.abs, 50);
    expectClose(drawdown.pct, 50 / 1000);
  });

  it("reconstructs from trades plus starting balance", () => {
    const metrics = computeMetrics({ trades: mixed, startingBalance: 1000 });
    assert.equal(metrics.drawdown.abs, 50);
    expectClose(metrics.drawdown.pct, 0.05);
  });
});

describe("breakdowns and deltas", () => {
  const metrics = computeMetrics({
    trades: mixed,
    previousTrades: [trade({ id: "P1", grossProfit: 100 }), trade({ id: "P2", grossProfit: -40 })],
    startingBalance: 1000
  });

  it("breaks down by symbol", () => {
    const gbp = metrics.bySymbol.find((symbol) => symbol.symbol === "GBPUSD");
    const eur = metrics.bySymbol.find((symbol) => symbol.symbol === "EURUSD");
    assert.equal(gbp.netPnl, 200);
    assert.equal(eur.netPnl, 0);
    assert.equal(eur.trades, 3);
  });

  it("breaks down by session", () => {
    const london = metrics.bySession.find((session) => session.session === "London");
    assert.equal(london.trades, 2);
    assert.equal(london.netPnl, 300);
    assert.equal(london.winRate, 1);
  });

  it("computes previous-period deltas", () => {
    assert.notEqual(metrics.deltas, null);
    assert.equal(metrics.deltas.netPnl.absolute, 140);
    assert.equal(metrics.deltas.totalTrades.current, 4);
    assert.equal(metrics.deltas.totalTrades.previous, 2);
    expectClose(metrics.deltas.winRate.current, 0.5);
    expectClose(metrics.deltas.winRate.previous, 0.5);
  });
});

describe("R-multiple histogram", () => {
  it("returns default empty bins for empty input", () => {
    assert.deepEqual(rMultipleHistogram([]), [
      { bin: "< -2R", count: 0, netPnl: 0 },
      { bin: "-2R to -1R", count: 0, netPnl: 0 },
      { bin: "-1R to 0R", count: 0, netPnl: 0 },
      { bin: "0R to 1R", count: 0, netPnl: 0 },
      { bin: "1R to 2R", count: 0, netPnl: 0 },
      { bin: "2R to 3R", count: 0, netPnl: 0 },
      { bin: "> 3R", count: 0, netPnl: 0 }
    ]);
  });

  it("puts all trades into one bin when their R values match that range", () => {
    const histogram = rMultipleHistogram([
      trade({ id: "R1", grossProfit: 50, rMultiple: 1.2 }),
      trade({ id: "R2", grossProfit: 75, rMultiple: 1.8 })
    ]);
    const bin = histogram.find((item) => item.bin === "1R to 2R");
    assert.equal(bin.count, 2);
    assert.equal(bin.netPnl, 125);
  });

  it("uses lower-inclusive boundaries, so exactly 1R falls into 1R to 2R", () => {
    const histogram = rMultipleHistogram([
      trade({ id: "B1", grossProfit: -100, rMultiple: -2 }),
      trade({ id: "B2", grossProfit: 100, rMultiple: 1 }),
      trade({ id: "B3", grossProfit: 300, rMultiple: 3 })
    ]);
    assert.equal(histogram.find((item) => item.bin === "< -2R").count, 0);
    assert.equal(histogram.find((item) => item.bin === "-2R to -1R").count, 1);
    assert.equal(histogram.find((item) => item.bin === "0R to 1R").count, 0);
    assert.equal(histogram.find((item) => item.bin === "1R to 2R").count, 1);
    assert.equal(histogram.find((item) => item.bin === "> 3R").count, 1);
  });

  it("excludes null R values without affecting other bins", () => {
    const histogram = rMultipleHistogram([
      trade({ id: "N1", grossProfit: 40, rMultiple: null }),
      trade({ id: "N2", grossProfit: 120, riskAmount: null }),
      trade({ id: "N3", grossProfit: -50, riskAmount: 50 })
    ]);
    assert.equal(histogram.reduce((total, item) => total + item.count, 0), 1);
    assert.equal(histogram.find((item) => item.bin === "-1R to 0R").count, 1);
  });
});

describe("weekday breakdown", () => {
  it("returns all weekdays with zero rows when there are no trades", () => {
    const rows = computeByDayOfWeek([], "UTC");
    assert.equal(rows.length, 7);
    assert.equal(rows.every((row) => row.trades === 0 && row.netPnl === 0 && row.winRate === 0), true);
    assert.deepEqual(rows.map((row) => row.weekday), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });

  it("groups by close-time weekday in the requested timezone", () => {
    const rows = computeByDayOfWeek(
      [
        trade({
          id: "TZ1",
          grossProfit: 100,
          closeTime: "2025-04-07T23:30:00Z"
        }),
        trade({
          id: "TZ2",
          grossProfit: -40,
          closeTime: "2025-04-08T09:30:00Z"
        })
      ],
      "Africa/Lagos"
    );
    const monday = rows.find((row) => row.weekday === "Mon");
    const tuesday = rows.find((row) => row.weekday === "Tue");
    assert.equal(monday.trades, 0);
    assert.equal(tuesday.trades, 2);
    assert.equal(tuesday.netPnl, 60);
    expectClose(tuesday.winRate, 0.5);
  });

  it("keeps the old computeByWeekday alias pointed at the canonical implementation", () => {
    assert.deepEqual(computeByWeekday([], "UTC"), computeByDayOfWeek([], "UTC"));
  });

  it("is wired into computeMetrics with the same timezone rules", () => {
    const metrics = computeMetrics({
      trades: [trade({ id: "TZ3", grossProfit: 100, closeTime: "2025-04-07T23:30:00Z", rMultiple: 1 })],
      timeZone: "Africa/Lagos"
    });
    assert.equal(metrics.byDayOfWeek.find((row) => row.weekday === "Tue").trades, 1);
    assert.equal(metrics.rMultipleHistogram.find((row) => row.bin === "1R to 2R").count, 1);
  });
});

describe("best and worst day", () => {
  it("returns null for empty daily series", () => {
    const metrics = computeMetrics({ trades: [] });
    assert.equal(metrics.bestDay, null);
    assert.equal(metrics.worstDay, null);
  });

  it("chooses the earliest date when best-day values tie", () => {
    const metrics = computeMetrics({
      trades: [
        trade({ id: "D1", grossProfit: 100, closeTime: "2025-04-07T09:00:00Z" }),
        trade({ id: "D2", grossProfit: -50, closeTime: "2025-04-08T09:00:00Z" }),
        trade({ id: "D3", grossProfit: 100, closeTime: "2025-04-09T09:00:00Z" })
      ]
    });
    assert.deepEqual(metrics.bestDay, { date: "2025-04-07", netPnl: 100 });
    assert.deepEqual(metrics.worstDay, { date: "2025-04-08", netPnl: -50 });
  });
});

describe("canonical MetricsResult contract", () => {
  it("includes every consolidated field", () => {
    const metrics = computeMetrics({ trades: mixed, previousTrades: [trade({ id: "P", grossProfit: 10 })], startingBalance: 1000 });
    for (const key of [
      "netPnl",
      "grossWin",
      "grossLoss",
      "totalTrades",
      "winningTrades",
      "losingTrades",
      "breakevenTrades",
      "winRate",
      "avgWin",
      "avgLoss",
      "profitFactor",
      "profitFactorReason",
      "expectancyCurrency",
      "avgWinR",
      "avgLossR",
      "expectancyR",
      "avgHoldSeconds",
      "largestWin",
      "largestLoss",
      "currentStreak",
      "longestWinStreak",
      "longestLossStreak",
      "drawdown",
      "dailySeries",
      "bySymbol",
      "bySession",
      "byDayOfWeek",
      "rMultipleHistogram",
      "bestDay",
      "worstDay",
      "deltas"
    ]) {
      assert.equal(Object.hasOwn(metrics, key), true, `missing ${key}`);
    }
    assert.equal(Object.hasOwn(metrics, "byWeekday"), false);
  });
});
