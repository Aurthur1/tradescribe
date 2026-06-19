import type { CoachProfileResponse, LeakSummary, MetricsResponse, Playbook, PlaybookPerformanceSummaryResponse, RecentTrade, TradeDetailResponse, WeeklyReview } from "./dashboard-data";

export const SAMPLE_ACCOUNT_CURRENCY = "USD";
export const SAMPLE_ANCHOR = "2025-04-09T12:00:00.000Z";
export const SAMPLE_ACCOUNT_CONTEXT = {
  balance: 52400,
  equity: 52700,
  lastSyncAt: "2025-04-12T22:14:00.000Z",
  name: "Sample MT5 Challenge",
  login: "8074312",
  status: "CONNECTED"
};

export const SAMPLE_DASHBOARD_DATA: MetricsResponse = {
  bySession: [
    { netPnl: 940, session: "London", trades: 44, winRate: 0.68 },
    { netPnl: 710, session: "New York", trades: 52, winRate: 0.63 },
    { netPnl: 420, session: "Tokyo", trades: 20, winRate: 0.6 },
    { netPnl: 630, session: "Sydney", trades: 12, winRate: 0.67 }
  ],
  bySymbol: [
    { netPnl: 1180, symbol: "EURUSD", trades: 38, winRate: 0.66 },
    { netPnl: 820, symbol: "XAUUSD", trades: 31, winRate: 0.61 },
    { netPnl: 430, symbol: "GBPUSD", trades: 27, winRate: 0.63 },
    { netPnl: 270, symbol: "NAS100", trades: 32, winRate: 0.66 }
  ],
  byDayOfWeek: [
    { netPnl: -700, trades: 11, weekday: "Mon", winRate: 0.45 },
    { netPnl: 1400, trades: 18, weekday: "Tue", winRate: 0.72 },
    { netPnl: 2000, trades: 24, weekday: "Wed", winRate: 0.75 },
    { netPnl: -1200, trades: 19, weekday: "Thu", winRate: 0.47 },
    { netPnl: 0, trades: 21, weekday: "Fri", winRate: 0.57 },
    { netPnl: 0, trades: 19, weekday: "Sat", winRate: 0.58 },
    { netPnl: 1200, trades: 16, weekday: "Sun", winRate: 0.69 }
  ],
  dailySeries: [
    { breakevenTrades: 1, cumulativePnl: 1200, date: "2025-04-06", losingTrades: 4, netPnl: 1200, rMultipleSum: 4.1, tradeCount: 16, winRate: 0.69, winningTrades: 11 },
    { breakevenTrades: 1, cumulativePnl: 500, date: "2025-04-07", losingTrades: 5, netPnl: -700, rMultipleSum: -2.4, tradeCount: 11, winRate: 0.45, winningTrades: 5 },
    { breakevenTrades: 0, cumulativePnl: 1900, date: "2025-04-08", losingTrades: 5, netPnl: 1400, rMultipleSum: 5.2, tradeCount: 18, winRate: 0.72, winningTrades: 13 },
    { breakevenTrades: 1, cumulativePnl: 3900, date: "2025-04-09", losingTrades: 5, netPnl: 2000, rMultipleSum: 7.8, tradeCount: 24, winRate: 0.75, winningTrades: 18 },
    { breakevenTrades: 1, cumulativePnl: 2700, date: "2025-04-10", losingTrades: 9, netPnl: -1200, rMultipleSum: -3.1, tradeCount: 19, winRate: 0.47, winningTrades: 9 },
    { breakevenTrades: 2, cumulativePnl: 2700, date: "2025-04-11", losingTrades: 7, netPnl: 0, rMultipleSum: 0.2, tradeCount: 21, winRate: 0.57, winningTrades: 12 },
    { breakevenTrades: 2, cumulativePnl: 2700, date: "2025-04-12", losingTrades: 6, netPnl: 0, rMultipleSum: 0, tradeCount: 19, winRate: 0.58, winningTrades: 11 }
  ],
  deltas: {
    netPnl: { absolute: 204.62, current: 2700, percent: 0.082, previous: 2495.38 },
    profitFactor: { absolute: 0.16, current: 2.14, percent: 0.08, previous: 1.98 },
    totalTrades: { absolute: -6.74, current: 128, percent: -0.05, previous: 134.74 },
    winRate: { absolute: 0.0686, current: 0.64, percent: 0.12, previous: 0.5714 }
  },
  drawdown: { abs: 1200, pct: 0.068 },
  avgHoldSeconds: 4100,
  avgLoss: -91.3,
  avgLossR: -0.82,
  avgWin: 122.5,
  avgWinR: 1.64,
  bestDay: { date: "2025-04-09", netPnl: 2000 },
  breakevenTrades: 10,
  currentStreak: { count: 2, type: "breakeven" },
  expectancyCurrency: 21.09,
  expectancyR: 0.37,
  grossLoss: -4200,
  grossWin: 6900,
  largestLoss: -540,
  largestWin: 760,
  losingTrades: 36,
  longestLossStreak: 3,
  longestWinStreak: 5,
  netPnl: 2700,
  period: { granularity: "week", label: "Apr 6 - Apr 12, 2025" },
  profitFactor: 2.14,
  profitFactorReason: null,
  rMultipleHistogram: [
    { bin: "< -2R", count: 3, netPnl: -980 },
    { bin: "-2R to -1R", count: 12, netPnl: -1680 },
    { bin: "-1R to 0R", count: 31, netPnl: -2100 },
    { bin: "0R to 1R", count: 28, netPnl: 870 },
    { bin: "1R to 2R", count: 34, netPnl: 2920 },
    { bin: "2R to 3R", count: 15, netPnl: 2360 },
    { bin: "> 3R", count: 5, netPnl: 1310 }
  ],
  totalTrades: 128,
  totalVolume: 126.4,
  winRate: 0.64,
  winningTrades: 82,
  worstDay: { date: "2025-04-10", netPnl: -1200 }
};

export const SAMPLE_LEAK_SUMMARY: LeakSummary = {
  missingStopTrades: 4,
  overtradingDays: 2,
  revengeTrades: 3,
  riskInconsistencyScore: 18
};

export const SAMPLE_RECENT_TRADES: RecentTrade[] = [
  { closeTime: "2025-04-12T17:45:00.000Z", id: "sample-trade-1", netProfit: 420, side: "BUY", symbol: "EURUSD" },
  { closeTime: "2025-04-12T15:10:00.000Z", id: "sample-trade-2", netProfit: -180, side: "SELL", symbol: "XAUUSD" },
  { closeTime: "2025-04-11T20:05:00.000Z", id: "sample-trade-3", netProfit: 260, side: "BUY", symbol: "GBPUSD" },
  { closeTime: "2025-04-10T14:32:00.000Z", id: "sample-trade-4", netProfit: -320, side: "SELL", symbol: "NAS100" },
  { closeTime: "2025-04-09T18:18:00.000Z", id: "sample-trade-5", netProfit: 760, side: "BUY", symbol: "XAUUSD" },
  { closeTime: "2025-04-09T12:50:00.000Z", id: "sample-trade-6", netProfit: 310, side: "SELL", symbol: "EURUSD" }
];

export const SAMPLE_PLAYBOOKS: Playbook[] = [
  {
    color: "#3B82F6",
    createdAt: "2025-03-10T09:00:00.000Z",
    description: "Momentum continuation after the London open clears pre-market structure.",
    id: "sample-playbook-london-breakout",
    isArchived: false,
    name: "London Breakout",
    rules: [
      { order: 0, text: "Price has cleared the Asian range with volume expansion" },
      { order: 1, text: "Pullback respects prior resistance as support" },
      { order: 2, text: "Initial stop is outside the range, not inside noise" }
    ],
    tags: ["London", "Momentum"],
    tradeCount: 42,
    updatedAt: "2025-04-12T09:00:00.000Z"
  },
  {
    color: "#8B5CF6",
    createdAt: "2025-03-12T09:00:00.000Z",
    description: "Trend pullbacks into moving-average confluence with defined invalidation.",
    id: "sample-playbook-ema-pullback",
    isArchived: false,
    name: "Pullback to EMA",
    rules: [
      { order: 0, text: "Higher-timeframe trend is aligned with trade direction" },
      { order: 1, text: "Price rejects the 20/50 EMA zone" },
      { order: 2, text: "Target offers at least 1.5R before the next supply/demand zone" }
    ],
    tags: ["Trend", "Pullback"],
    tradeCount: 31,
    updatedAt: "2025-04-12T09:00:00.000Z"
  },
  {
    color: "#22C55E",
    createdAt: "2025-03-18T09:00:00.000Z",
    description: "Late-session rejection pattern after liquidity sweep and momentum failure.",
    id: "sample-playbook-ny-reversal",
    isArchived: false,
    name: "NY Reversal",
    rules: [
      { order: 0, text: "Liquidity sweep is visible on the session high or low" },
      { order: 1, text: "Reversal candle closes back inside the prior range" },
      { order: 2, text: "Position size is reduced after two prior trades" }
    ],
    tags: ["New York", "Reversal"],
    tradeCount: 18,
    updatedAt: "2025-04-12T09:00:00.000Z"
  }
];

export const SAMPLE_PLAYBOOK_PERFORMANCE: PlaybookPerformanceSummaryResponse = {
  playbooks: [
    { ...SAMPLE_PLAYBOOKS[0]!, metrics: { ...SAMPLE_DASHBOARD_DATA, netPnl: 1680, totalTrades: 42, winRate: 0.69, profitFactor: 2.42 } },
    { ...SAMPLE_PLAYBOOKS[1]!, metrics: { ...SAMPLE_DASHBOARD_DATA, netPnl: 790, totalTrades: 31, winRate: 0.61, profitFactor: 1.88 } },
    { ...SAMPLE_PLAYBOOKS[2]!, metrics: { ...SAMPLE_DASHBOARD_DATA, netPnl: -210, totalTrades: 18, winRate: 0.44, profitFactor: 0.92 } }
  ],
  untagged: { metrics: { ...SAMPLE_DASHBOARD_DATA, netPnl: 440, totalTrades: 37, winRate: 0.54, profitFactor: 1.24 } }
};

export function sampleTradeDetail(id: string): TradeDetailResponse | null {
  const base = SAMPLE_RECENT_TRADES.find((trade) => trade.id === id);
  if (!base) return null;

  const won = base.netProfit >= 0;
  const openPrice = base.symbol === "XAUUSD" ? 2328.4 : base.symbol === "NAS100" ? 18120.5 : 1.0842;
  const closePrice = base.side === "BUY" ? openPrice + (won ? 0.0048 : -0.0022) : openPrice + (won ? -0.0034 : 0.0024);
  const openTime = new Date(new Date(base.closeTime).getTime() - 46 * 60 * 1000).toISOString();
  const stopLoss = base.side === "BUY" ? openPrice - 0.0028 : openPrice + 0.0028;
  const takeProfit = base.side === "BUY" ? openPrice + 0.006 : openPrice - 0.006;

  return {
    closePrice,
    closeTime: base.closeTime,
    commission: -4.2,
    durationSec: 46 * 60,
    grossProfit: base.netProfit + 4.2,
    id,
    journalEntry: {
      createdAt: base.closeTime,
      id: `${id}-journal`,
      summary:
        "Observed: London continuation setup after a clean pullback into prior structure. Inferred: execution quality improved when the stop stayed outside the noise zone, but the entry was slightly early relative to confirmation.",
      updatedAt: base.closeTime
    },
    leakFlags: won
      ? []
      : [
          {
            evidence: { minutesAfter: 4, sizeMultiplier: 1.8 },
            id: `${id}-leak`,
            severity: "warning",
            status: "active",
            tradeIds: [id],
            type: "revenge_trade"
          }
        ],
    netProfit: base.netProfit,
    notes: [
      {
        body: "Sample note: waited for the first rejection, but still entered before the second candle closed.",
        createdAt: base.closeTime,
        emotion: "Impatient",
        emotionTags: won ? ["Disciplined", "Confident"] : ["FOMO", "Impulsive"],
        id: `${id}-note`,
        playbookChecklist: [
          { checked: true, ruleIndex: 0 },
          { checked: won, ruleIndex: 1 },
          { checked: true, ruleIndex: 2 }
        ],
        updatedAt: base.closeTime
      }
    ],
    openPrice,
    openTime,
    playbook: SAMPLE_PLAYBOOKS[0]!,
    playbookId: SAMPLE_PLAYBOOKS[0]!.id,
    rMultiple: won ? 1.7 : -0.8,
    riskAmount: Math.abs(base.netProfit / (won ? 1.7 : 0.8)),
    screenshots: [],
    session: "London",
    side: base.side,
    stopLoss,
    swap: 0,
    symbol: base.symbol,
    takeProfit,
    tradingAccountId: "sample-account",
    tradingAccount: {
      currency: SAMPLE_ACCOUNT_CURRENCY,
      id: "sample-account",
      login: SAMPLE_ACCOUNT_CONTEXT.login,
      name: SAMPLE_ACCOUNT_CONTEXT.name
    },
    volume: base.symbol === "NAS100" ? 1.5 : 0.8
  };
}

export const SAMPLE_WEEKLY_REVIEW: WeeklyReview = {
  actions: [
    "Cap the London session at three trades and write the reason for stopping.",
    "After a full-risk loss, wait five minutes and screenshot the next setup before entering.",
    "Tag every avoided impulse entry so the review can count discipline, not only trades taken."
  ],
  createdAt: "2025-04-13T09:00:00.000Z",
  id: "sample-weekly-review",
  leaks: [
    {
      evidence: { minutesAfter: 4, sizeMultiplier: 1.8 },
      explanation: "The fastest re-entry happened after a losing trade, and size increased before the setup quality improved.",
      id: "sample-leak-revenge",
      severity: "warning",
      tradeIds: ["sample-trade-2"],
      type: "revenge_trade"
    },
    {
      evidence: { dayCount: 24, threshold: 18 },
      explanation: "The busiest day produced the most noise. Your strongest decisions came earlier in the session.",
      id: "sample-leak-overtrading",
      severity: "info",
      tradeIds: ["sample-trade-5", "sample-trade-6"],
      type: "overtrading"
    }
  ],
  periodEnd: "2025-04-12T23:59:59.999Z",
  periodStart: "2025-04-06T00:00:00.000Z",
  strengths: [
    "You respected defined risk on the best-performing trades.",
    "Your London-session winners had cleaner setup notes than the losing trades.",
    "You recovered from a midweek loss without increasing total daily exposure."
  ],
  summary:
    "Your week was profitable, but the quality gap is clear: patient trades with defined risk carried the results, while rushed re-entries created the most coachable leaks.",
  updatedAt: "2025-04-13T09:00:00.000Z"
};

export const SAMPLE_COACH_PROFILE: CoachProfileResponse = {
  advice: SAMPLE_WEEKLY_REVIEW.actions.map((text, index) => ({
    createdAt: "2025-04-13T09:00:00.000Z",
    id: `sample-advice-${index + 1}`,
    status: index === 0 ? "did_this" : "pending",
    text,
    weekStart: SAMPLE_WEEKLY_REVIEW.periodStart
  })),
  locked: false,
  profile: {
    goals: ["Max 3 trades/day", "No re-entry within 5 minutes of a full-risk loss"],
    recurringLeaks: [
      { count: 4, label: "Revenge trading", trend: [0, 1, 1, 0, 1, 1], weeks: 6 },
      { count: 3, label: "Overtrading", trend: [1, 0, 1, 0, 0, 1], weeks: 6 }
    ],
    riskProfileSummary: "You perform best when planned risk is visible before entry and session limits are decided before the first trade.",
    updatedAt: "2025-04-13T09:00:00.000Z"
  }
};
